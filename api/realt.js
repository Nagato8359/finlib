// GET /api/realt?action=wallet&address=0x...  — RealT token balances
// GET /api/realt?action=rents&address=0x...   — RealT rent history (USDC from DisperseV2)
const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const COMMUNITY_URLS = [
  'https://api.realtoken.community/v1/token',
  'https://api.realtoken.community/v1/token?limit=1000',
  'https://api.realtoken.community/v2/token',
];

const USDC_ADDR   = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83';
const DISPERSE_V2 = '0xf215af7efd2d90f7492a13c3147defd7f1b41a8e';

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── Wallet: community token price index ───────────────────────────────────────

async function fetchCommunityApi() {
  const cacheKey = 'realt:community:v1';
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const attempts = [];

  for (const url of COMMUNITY_URLS) {
    const attempt = { url, status: null, bodySnippet: '' };
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      attempt.status = res.status;
      attempt.bodySnippet = text.slice(0, 200);
      console.log(`[realt] community ${url} → HTTP ${res.status} | ${text.slice(0, 120)}`);
      attempts.push(attempt);

      if (!res.ok) continue;

      let parsed;
      try { parsed = JSON.parse(text); } catch { continue; }

      const list = Array.isArray(parsed)
        ? parsed
        : (parsed?.data || parsed?.tokens || parsed?.items || []);
      if (!list.length) continue;

      const index = {};
      for (const t of list) {
        const tokenPrice = parseFloat(t.tokenPrice) || 0;
        if (tokenPrice <= 0) continue;
        const entry = {
          tokenPrice,
          annualPercentageYield: parseFloat(t.annualPercentageYield) || 0,
          fullName:  t.fullName  || t.shortName || '',
          shortName: t.shortName || '',
        };
        for (const field of ['gnosisContract', 'xDaiContract', 'address']) {
          const addr = (t[field] || '').toLowerCase().trim();
          if (addr && addr.length === 42 && addr.startsWith('0x')) index[addr] = entry;
        }
      }

      if (!Object.keys(index).length) continue;

      console.log(`[realt] community API: ${Object.keys(index).length} tokens indexed from ${url}`);
      const result = { index, debug: { url, status: res.status, bodySnippet: text.slice(0, 200), indexed: Object.keys(index).length, attempts } };
      await setCached(cacheKey, result, 3600);
      return result;
    } catch (e) {
      attempt.status = 0;
      attempt.bodySnippet = e.message.slice(0, 200);
      attempts.push(attempt);
      console.error(`[realt] community ${url} threw: ${e.message}`);
    }
  }

  console.error('[realt] all community API URLs failed');
  return { index: {}, debug: { url: null, status: null, bodySnippet: '', indexed: 0, attempts } };
}

async function fetchBlockscout(addr) {
  const url = `https://gnosis.blockscout.com/api/v2/addresses/${addr}/token-balances`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 300);
    console.log(`[realt] Blockscout → HTTP ${res.status} | ${bodySnippet}`);

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

    console.log(`[realt] Blockscout: ${raw.length} ERC-20, ${items.length} RealT`);
    return { items, rawCount: raw.length, status: res.status, ok: true, bodySnippet };
  } catch (e) {
    console.error(`[realt] Blockscout threw: ${e.message}`);
    return { items: [], status: 0, ok: false, bodySnippet: e.message };
  }
}

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
    name:             listed?.fullName || listed?.shortName || token.name || 'RealT Token',
    contractAddress,
    amount,
    priceUSD:         priceUSD != null ? parseFloat(priceUSD.toFixed(4)) : null,
    priceEUR:         priceEUR != null ? parseFloat(priceEUR.toFixed(2)) : null,
    totalUSD:         priceUSD != null ? parseFloat((amount * priceUSD).toFixed(2)) : null,
    totalEUR:         priceEUR != null ? parseFloat((amount * priceEUR).toFixed(2)) : null,
    annualYield:      listed?.annualPercentageYield ? parseFloat(listed.annualPercentageYield) : null,
    priceSource:      hasPrice ? (listed ? 'community' : 'blockscout') : null,
    needsManualPrice: !hasPrice,
  };
}

// ── Rents: paginated ERC-20 transfers ─────────────────────────────────────────

async function fetchAllTransfers(address) {
  const all = [];
  let nextParams = null;
  let page = 0;
  const maxPages = 10;

  do {
    let url = `https://gnosis.blockscout.com/api/v2/addresses/${address}/token-transfers?type=ERC-20&filter=to`;
    if (nextParams) {
      const qs = Object.entries(nextParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      url += `&${qs}`;
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.error(`[realt] rents Blockscout HTTP ${res.status}`); break; }

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    all.push(...items);
    nextParams = data?.next_page_params || null;
    page++;
  } while (nextParams && page < maxPages);

  console.log(`[realt] rents: fetched ${all.length} transfers in ${page} page(s)`);
  return { items: all, pagesScanned: page };
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { action, address } = req.query;

  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    return res.status(400).json({ error: 'Adresse wallet invalide (format : 0x + 40 hex)' });
  }
  const addr = address.toLowerCase();

  // ── action=wallet ────────────────────────────────────────────────────────────
  if (action === 'wallet') {
    try {
      const [blockscout, eurusd, communityResult] = await Promise.all([
        fetchBlockscout(addr),
        getEURUSD(),
        fetchCommunityApi(),
      ]);

      const { index: priceIndex, debug: apiDebug } = communityResult;
      const tokens = blockscout.items.map(item => itemToToken(item, eurusd, priceIndex)).filter(Boolean);
      const withPrice = tokens.filter(t => !t.needsManualPrice).length;

      const debug = {
        address: addr,
        blockscout: {
          status:      blockscout.status,
          ok:          blockscout.ok,
          rawERC20:    blockscout.rawCount ?? 0,
          realtFound:  blockscout.items?.length ?? 0,
          withPrice,
          bodySnippet: blockscout.bodySnippet,
        },
        tokenList: {
          url:         apiDebug?.url,
          status:      apiDebug?.status,
          bodySnippet: apiDebug?.bodySnippet,
          indexed:     apiDebug?.indexed ?? 0,
          attempts:    apiDebug?.attempts,
        },
        eurusd,
      };

      if (tokens.length === 0) {
        return res.status(404).json({ error: 'Aucun token RealT trouvé pour cette adresse', debug });
      }

      console.log(`[realt] wallet ${addr}: ${tokens.length} tokens (${withPrice} with price)`);
      return res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length, debug });
    } catch (err) {
      console.error('[realt] wallet fatal:', err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  // ── action=rents ─────────────────────────────────────────────────────────────
  if (action === 'rents') {
    const cacheKey = `realt:rents:${addr}`;
    const forceRefresh = req.query.refresh === 'true';

    try {
      const cached = await getCached(cacheKey);
      if (cached && !forceRefresh) return res.json({ ...cached, cached: true });

      const [{ items: transfers, pagesScanned }, eurusd] = await Promise.all([fetchAllTransfers(addr), getEURUSD()]);

      const tokenAddrOf = item => (item.token?.address_hash || item.token?.address || '').toLowerCase();
      const rentTransfers = transfers.filter(item => {
        const fromAddr = (item.from?.hash || '').toLowerCase();
        return tokenAddrOf(item) === USDC_ADDR && fromAddr === DISPERSE_V2;
      });

      const debug = {
        pagesScanned,
        rawTransfersCount:   transfers.length,
        disperseV2Transfers: transfers.filter(i => (i.from?.hash || '').toLowerCase() === DISPERSE_V2).length,
        usdcTransfers:       transfers.filter(i => tokenAddrOf(i) === USDC_ADDR).length,
        sample:              transfers.slice(0, 3),
      };

      console.log(`[realt] rents ${addr}: ${rentTransfers.length} rent transfers (USDC from DisperseV2)`);

      const allRents = rentTransfers.map(item => {
        const amountUSD = parseFloat(item.total?.value || '0') / 1e6;
        const amountEUR = amountUSD / eurusd;
        return {
          date:      item.timestamp ? item.timestamp.slice(0, 10) : '',
          amountUSD: parseFloat(amountUSD.toFixed(4)),
          amountEUR: parseFloat(amountEUR.toFixed(4)),
          txHash:    item.tx_hash || '',
        };
      }).filter(r => r.amountUSD > 0);

      allRents.sort((a, b) => b.date.localeCompare(a.date));

      const byMonthMap = {};
      for (const r of allRents) {
        const month = r.date.slice(0, 7);
        if (!byMonthMap[month]) byMonthMap[month] = { month, amountUSD: 0, amountEUR: 0, count: 0 };
        byMonthMap[month].amountUSD += r.amountUSD;
        byMonthMap[month].amountEUR += r.amountEUR;
        byMonthMap[month].count++;
      }
      const byMonth = Object.values(byMonthMap)
        .map(m => ({ ...m, amountUSD: parseFloat(m.amountUSD.toFixed(4)), amountEUR: parseFloat(m.amountEUR.toFixed(4)) }))
        .sort((a, b) => b.month.localeCompare(a.month));

      const cutoff12M = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const last12M = allRents.filter(r => r.date >= cutoff12M);
      const last12MonthsUSD = parseFloat(last12M.reduce((s, r) => s + r.amountUSD, 0).toFixed(4));
      const last12MonthsEUR = parseFloat(last12M.reduce((s, r) => s + r.amountEUR, 0).toFixed(4));

      const totalRentsUSD = parseFloat(allRents.reduce((s, r) => s + r.amountUSD, 0).toFixed(4));
      const totalRentsEUR = parseFloat(allRents.reduce((s, r) => s + r.amountEUR, 0).toFixed(4));

      const result = {
        totalRentsUSD, totalRentsEUR,
        last12MonthsUSD, last12MonthsEUR,
        byMonth, allRents,
        eurusd, count: allRents.length,
        debug,
      };

      const prevCount = cached?.count ?? 0;
      if (allRents.length !== prevCount) {
        console.log(`[realt] rents ${addr}: count ${prevCount} → ${allRents.length}`);
      }

      if (allRents.length > 0) await setCached(cacheKey, result, 604800);
      return res.json(result);
    } catch (err) {
      console.error('[realt] rents fatal:', err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'action must be wallet or rents' });
};
