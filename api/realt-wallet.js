const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TOKEN_LIST_URLS = [
  'https://realt.co/wp-json/realt/v1/tokens',
  'https://data.realt.co/tokens.json',
  'https://raw.githubusercontent.com/RealToken-Community/dashboard-v2/main/public/data/realtokens.json',
];

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── RealT token price list → index by contract address ───────────────────────
async function fetchTokenList() {
  const cacheKey = 'realt:v3:tokenlist';
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  let lastDebug = { url: null, status: null, bodySnippet: null };

  for (const url of TOKEN_LIST_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': CHROME_UA },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      lastDebug = { url, status: res.status, bodySnippet: text.slice(0, 200) };
      console.log(`[realt-wallet] token list ${url} → HTTP ${res.status} | ${text.slice(0, 120)}`);

      if (!res.ok) continue;

      let parsed;
      try { parsed = JSON.parse(text); } catch { continue; }

      const list = Array.isArray(parsed) ? parsed : (parsed?.tokens || parsed?.data || []);
      if (!list.length) continue;

      const index = {};
      for (const t of list) {
        const addr = (t.gnosisContract || t.xDaiContract || t.address || '').toLowerCase();
        if (addr && addr.length === 42) index[addr] = t;
      }

      if (!Object.keys(index).length) continue;

      console.log(`[realt-wallet] token list: ${Object.keys(index).length} indexed from ${url}`);
      const result = { index, debug: { url, status: res.status, bodySnippet: text.slice(0, 200) } };
      await setCached(cacheKey, result, 3600);
      return result;
    } catch (e) {
      lastDebug = { url, status: 0, bodySnippet: e.message };
      console.error(`[realt-wallet] token list ${url} threw: ${e.message}`);
    }
  }

  console.error('[realt-wallet] all token list URLs failed');
  return { index: {}, debug: lastDebug };
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

// Priority: token list tokenPrice → Blockscout exchange_rate → skip
function itemToToken(item, eurusd, priceIndex) {
  const token    = item.token || {};
  const decimals = parseInt(token.decimals, 10) || 18;
  const amount   = parseFloat(item.value || '0') / Math.pow(10, decimals);
  if (amount <= 0) return null;

  const contractAddress = (token.address || token.address_hash || '').toLowerCase();
  const listed = priceIndex[contractAddress];

  const priceUSD = parseFloat(listed?.tokenPrice || token.exchange_rate || '0');
  if (priceUSD <= 0) return null;

  const priceEUR = priceUSD / eurusd;

  return {
    symbol:          token.symbol || 'REALT',
    name:            listed?.fullName || listed?.shortName || token.name || 'RealT Token',
    contractAddress,
    amount,
    priceUSD:        parseFloat(priceUSD.toFixed(4)),
    priceEUR:        parseFloat(priceEUR.toFixed(2)),
    totalUSD:        parseFloat((amount * priceUSD).toFixed(2)),
    totalEUR:        parseFloat((amount * priceEUR).toFixed(2)),
    annualYield:     listed?.annualPercentageYield ? parseFloat(listed.annualPercentageYield) : null,
    priceSource:     listed ? 'tokenlist' : 'blockscout',
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
    const [blockscout, eurusd, tokenListResult] = await Promise.all([
      fetchBlockscout(addr),
      getEURUSD(),
      fetchTokenList(),
    ]);

    const { index: priceIndex, debug: tokenListDebug } = tokenListResult;
    const tokens = blockscout.items.map(item => itemToToken(item, eurusd, priceIndex)).filter(Boolean);

    const debug = {
      address: addr,
      blockscout: {
        status:      blockscout.status,
        ok:          blockscout.ok,
        rawERC20:    blockscout.rawCount ?? 0,
        realtFound:  blockscout.items?.length ?? 0,
        withPrice:   tokens.length,
        bodySnippet: blockscout.bodySnippet,
      },
      tokenList: {
        size:        Object.keys(priceIndex).length,
        url:         tokenListDebug?.url,
        status:      tokenListDebug?.status,
        bodySnippet: tokenListDebug?.bodySnippet,
      },
      eurusd,
    };

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Aucun token RealT trouvé pour cette adresse', debug });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens (list size: ${Object.keys(priceIndex).length})`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length, debug });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
