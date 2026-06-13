const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── Cryptalloc CSV → RealT token price index ─────────────────────────────────
function parseCsvRow(line) {
  const values = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  values.push(cur.trim());
  return values.map(v => v.replace(/^"|"$/g, ''));
}

async function fetchCryptalloc() {
  const cacheKey = 'realt:csv:v1';
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const url = 'https://www.cryptalloc.com/realtlab/properties.csv';
  const csvDebug = { url, status: null, size: 0, snippet: '', headers: [], cols: {} };

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': CHROME_UA, 'Accept': 'text/csv,text/plain,*/*' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    csvDebug.status = res.status;
    csvDebug.size = text.length;
    csvDebug.snippet = text.slice(0, 50);
    console.log(`[realt-wallet] Cryptalloc → HTTP ${res.status} | ${text.slice(0, 100)}`);

    if (!res.ok) return { index: {}, debug: csvDebug };

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { index: {}, debug: csvDebug };

    const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase());
    csvDebug.headers = headers;

    const find = (...kws) => {
      for (const kw of kws) {
        const i = headers.findIndex(h => h.includes(kw));
        if (i >= 0) return i;
      }
      return -1;
    };

    const iAddr  = find('gnosis', 'xdai', 'contract_address', 'contract');
    const iPrice = find('tokenprice', 'token_price', 'price');
    const iApy   = find('annualpercentageyield', 'annual_percentage_yield', 'apy', 'yield', 'annual');
    const iName  = find('fullname', 'full_name', 'shortname', 'name', 'title');
    csvDebug.cols = { addr: iAddr, price: iPrice, apy: iApy, name: iName };

    if (iAddr < 0 || iPrice < 0) {
      console.error('[realt-wallet] Cryptalloc CSV: required columns not found', headers);
      return { index: {}, debug: csvDebug };
    }

    const index = {};
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const vals = parseCsvRow(line);
      const addr = (vals[iAddr] || '').toLowerCase().trim();
      if (!addr || addr.length !== 42 || !addr.startsWith('0x')) continue;
      const tokenPrice = parseFloat(vals[iPrice]) || 0;
      if (tokenPrice <= 0) continue;
      index[addr] = {
        tokenPrice,
        annualPercentageYield: iApy >= 0 ? parseFloat(vals[iApy]) || 0 : 0,
        fullName:              iName >= 0 ? (vals[iName] || '') : '',
      };
    }

    console.log(`[realt-wallet] Cryptalloc: ${Object.keys(index).length} tokens indexed`);
    const result = { index, debug: csvDebug };
    if (Object.keys(index).length > 0) await setCached(cacheKey, result, 3600);
    return result;
  } catch (e) {
    csvDebug.snippet = e.message.slice(0, 50);
    console.error(`[realt-wallet] Cryptalloc threw: ${e.message}`);
    return { index: {}, debug: csvDebug };
  }
}

// ── Blockscout Gnosis → ERC-20 RealT balances ────────────────────────────────
async function fetchBlockscout(addr) {
  const url = `https://gnosis.blockscout.com/api/v2/addresses/${addr}/token-balances`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 300);
    console.log(`[realt-wallet] Blockscout → HTTP ${res.status} | ${bodySnippet}`);

    if (!res.ok) return { items: [], status: res.status, ok: false, bodySnippet };

    let data;
    try { data = JSON.parse(text); } catch {
      return { items: [], status: res.status, ok: false, bodySnippet };
    }

    const raw = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    const items = raw.filter(item => {
      if (item?.token?.type && !/ERC-?20/i.test(item.token.type)) return false;
      const name = item?.token?.name || '';
      const sym  = item?.token?.symbol || '';
      return /realtoken/i.test(name) || /realtoken/i.test(sym);
    });

    console.log(`[realt-wallet] Blockscout: ${raw.length} ERC-20, ${items.length} RealT`);
    return { items, rawCount: raw.length, status: res.status, ok: true, bodySnippet };
  } catch (e) {
    console.error(`[realt-wallet] Blockscout threw: ${e.message}`);
    return { items: [], status: 0, ok: false, bodySnippet: e.message };
  }
}

// Priority: Cryptalloc tokenPrice → Blockscout exchange_rate → needsManualPrice
function itemToToken(item, eurusd, priceIndex) {
  const token    = item.token || {};
  const decimals = parseInt(token.decimals, 10) || 18;
  const amount   = parseFloat(item.value || '0') / Math.pow(10, decimals);
  if (amount <= 0) return null;

  const contractAddress = (token.address || token.address_hash || '').toLowerCase();
  const listed = priceIndex[contractAddress];

  const rawPriceUSD = parseFloat(listed?.tokenPrice || token.exchange_rate || '0');
  const hasPrice = rawPriceUSD > 0;
  const priceUSD = hasPrice ? rawPriceUSD : null;
  const priceEUR = hasPrice ? rawPriceUSD / eurusd : null;

  return {
    symbol:           token.symbol || 'REALT',
    name:             listed?.fullName || token.name || 'RealT Token',
    contractAddress,
    amount,
    priceUSD:         priceUSD != null ? parseFloat(priceUSD.toFixed(4)) : null,
    priceEUR:         priceEUR != null ? parseFloat(priceEUR.toFixed(2)) : null,
    totalUSD:         priceUSD != null ? parseFloat((amount * priceUSD).toFixed(2)) : null,
    totalEUR:         priceEUR != null ? parseFloat((amount * priceEUR).toFixed(2)) : null,
    annualYield:      listed?.annualPercentageYield ? parseFloat(listed.annualPercentageYield) : null,
    priceSource:      hasPrice ? (listed ? 'cryptalloc' : 'blockscout') : null,
    needsManualPrice: !hasPrice,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    return res.status(400).json({ error: 'Adresse wallet invalide (format : 0x + 40 hex)' });
  }

  const addr = address.toLowerCase();

  try {
    const [blockscout, eurusd, cryptallocResult] = await Promise.all([
      fetchBlockscout(addr),
      getEURUSD(),
      fetchCryptalloc(),
    ]);

    const { index: priceIndex, debug: csvDebug } = cryptallocResult;
    const tokens = blockscout.items.map(item => itemToToken(item, eurusd, priceIndex)).filter(Boolean);
    const withPrice = tokens.filter(t => !t.needsManualPrice).length;

    const debug = {
      address: addr,
      blockscout: {
        status:     blockscout.status,
        ok:         blockscout.ok,
        rawERC20:   blockscout.rawCount ?? 0,
        realtFound: blockscout.items?.length ?? 0,
        withPrice,
        bodySnippet: blockscout.bodySnippet,
      },
      csv: {
        status:  csvDebug?.status,
        size:    csvDebug?.size,
        snippet: csvDebug?.snippet,
        headers: csvDebug?.headers,
        cols:    csvDebug?.cols,
        indexed: Object.keys(priceIndex).length,
      },
      eurusd,
    };

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Aucun token RealT trouvé pour cette adresse', debug });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens (${withPrice} with price)`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length, debug });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
