const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

const USDC_ADDR    = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'; // USDC on Gnosis
const DISPERSE_V2  = '0xf215af7efd2d90f7492a13c3147defd7f1b41a8e'; // RealT DisperseV2

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// Paginate incoming ERC-20 transfers, up to maxPages pages (~50 items each)
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
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.error(`[realt-rents] Blockscout HTTP ${res.status}`); break; }

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    all.push(...items);
    nextParams = data?.next_page_params || null;
    page++;
  } while (nextParams && page < maxPages);

  console.log(`[realt-rents] fetched ${all.length} transfers in ${page} page(s)`);
  return all;
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
  const cacheKey = `realt:rents:${addr}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const [transfers, eurusd] = await Promise.all([fetchAllTransfers(addr), getEURUSD()]);

    // Keep only USDC transfers from DisperseV2 (= RealT rent payments)
    const rentTransfers = transfers.filter(item => {
      const tokenAddr = (item.token?.address || '').toLowerCase();
      const fromAddr  = (item.from?.hash   || '').toLowerCase();
      return tokenAddr === USDC_ADDR && fromAddr === DISPERSE_V2;
    });

    console.log(`[realt-rents] ${addr}: ${rentTransfers.length} rent transfers (USDC from DisperseV2)`);

    // Parse each rent
    const allRents = rentTransfers.map(item => {
      const amountUSD = parseFloat(item.total?.value || '0') / 1e6; // USDC = 6 decimals
      const amountEUR = amountUSD / eurusd;
      return {
        date:      item.timestamp ? item.timestamp.slice(0, 10) : '',
        amountUSD: parseFloat(amountUSD.toFixed(4)),
        amountEUR: parseFloat(amountEUR.toFixed(4)),
        txHash:    item.tx_hash || '',
      };
    }).filter(r => r.amountUSD > 0);

    allRents.sort((a, b) => b.date.localeCompare(a.date));

    // Group by month (YYYY-MM)
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

    // Last 12 months totals (for yield calculation in frontend)
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
    };

    if (allRents.length > 0) await setCached(cacheKey, result, 1800);
    res.json(result);
  } catch (err) {
    console.error('[realt-rents] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
