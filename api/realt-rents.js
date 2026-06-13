const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

// Known stablecoins on Gnosis Chain used by RealT for rent payments
const STABLECOINS = {
  '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83': { symbol: 'USDC', decimals: 6, isUSD: true },
  '0x4ecaba5870353805a9f068101a40e0f32ed605c6': { symbol: 'USDT', decimals: 6, isUSD: true },
  '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d': { symbol: 'WXDAI', decimals: 18, isUSD: true },
  '0xcb444e90d8198415266c6a2724b7900fb12fc56e': { symbol: 'EURe', decimals: 18, isUSD: false },
};

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// Paginate up to maxPages pages of token-transfers (50 items/page)
async function fetchAllTransfers(address) {
  const all = [];
  let nextParams = null;
  let page = 0;
  const maxPages = 8; // ~400 transfers max

  do {
    let url = `https://gnosis.blockscout.com/api/v2/addresses/${address}/token-transfers?type=ERC-20&filter=to`;
    if (nextParams) {
      const qs = Object.entries(nextParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
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

// Build property name index: contractAddress → name
async function fetchPropertyIndex(walletAddress) {
  const url = `https://gnosis.blockscout.com/api/v2/addresses/${walletAddress}/token-balances`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const raw = Array.isArray(data) ? data : (data?.items || []);
    const index = {};
    for (const item of raw) {
      const token = item.token || {};
      if (!/realtoken/i.test(token.name || '') && !/realtoken/i.test(token.symbol || '')) continue;
      const addr = (token.address || '').toLowerCase();
      if (addr) index[addr] = token.name || token.symbol || addr;
    }
    return index;
  } catch (e) {
    console.error('[realt-rents] propertyIndex error:', e.message);
    return {};
  }
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

    const [transfers, propertyIndex, eurusd] = await Promise.all([
      fetchAllTransfers(addr),
      fetchPropertyIndex(addr),
      getEURUSD(),
    ]);

    // Filter: only stablecoin incoming transfers
    const rentTransfers = transfers.filter(item => {
      const tokenAddr = (item.token?.address || '').toLowerCase();
      return STABLECOINS[tokenAddr] !== undefined;
    });

    console.log(`[realt-rents] ${addr}: ${rentTransfers.length} rent transfers from ${transfers.length} total`);

    // Parse each rent transfer
    const allRents = rentTransfers.map(item => {
      const tokenAddr = (item.token?.address || '').toLowerCase();
      const stable = STABLECOINS[tokenAddr];
      const decimals = parseInt(item.total?.decimals ?? item.token?.decimals ?? stable.decimals, 10);
      const rawAmount = parseFloat(item.total?.value || '0') / Math.pow(10, decimals);

      const amountUSD = stable.isUSD ? rawAmount : rawAmount * eurusd;
      const amountEUR = stable.isUSD ? rawAmount / eurusd : rawAmount;

      const fromAddr = (item.from?.hash || '').toLowerCase();
      const propertyName = propertyIndex[fromAddr] || null;

      return {
        date:         item.timestamp ? item.timestamp.slice(0, 10) : '',
        from:         fromAddr,
        propertyName,
        stablecoin:   stable.symbol,
        amountRaw:    parseFloat(rawAmount.toFixed(6)),
        amountUSD:    parseFloat(amountUSD.toFixed(4)),
        amountEUR:    parseFloat(amountEUR.toFixed(4)),
        txHash:       item.tx_hash || '',
      };
    }).filter(r => r.amountUSD > 0);

    // Sort chronologically descending
    allRents.sort((a, b) => b.date.localeCompare(a.date));

    // Group by sender (property contract)
    const byFromMap = {};
    for (const r of allRents) {
      if (!byFromMap[r.from]) {
        byFromMap[r.from] = {
          propertyName:    r.propertyName || r.from,
          contractAddress: r.from,
          rents:           [],
          totalUSD:        0,
          totalEUR:        0,
          count:           0,
        };
      }
      byFromMap[r.from].rents.push({ date: r.date, amountUSD: r.amountUSD, amountEUR: r.amountEUR, txHash: r.txHash });
      byFromMap[r.from].totalUSD += r.amountUSD;
      byFromMap[r.from].totalEUR += r.amountEUR;
      byFromMap[r.from].count++;
    }

    const byProperty = Object.values(byFromMap)
      .map(p => ({ ...p, totalUSD: parseFloat(p.totalUSD.toFixed(4)), totalEUR: parseFloat(p.totalEUR.toFixed(4)) }))
      .sort((a, b) => b.totalEUR - a.totalEUR);

    const totalRentsUSD = parseFloat(allRents.reduce((s, r) => s + r.amountUSD, 0).toFixed(4));
    const totalRentsEUR = parseFloat(allRents.reduce((s, r) => s + r.amountEUR, 0).toFixed(4));

    const result = { totalRentsUSD, totalRentsEUR, byProperty, allRents, eurusd, count: allRents.length };
    if (allRents.length > 0) await setCached(cacheKey, result, 1800);

    res.json(result);
  } catch (err) {
    console.error('[realt-rents] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
