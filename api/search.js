// Proxy CORS-safe search: Yahoo Finance (stocks/ISIN) and CoinGecko (crypto)
const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

const LOGO_DEV_TOKEN = 'pk_X4dPbXQbTBuiGqrJH9u8VA';

// Fetch website domain from Yahoo Finance assetProfile, return Logo.dev URL
// Cached 7 days per ticker base symbol
async function fetchLogoUrl(symbol) {
  const base = symbol.split('.')[0].toUpperCase();
  const cacheKey = `logo:${base}`;
  try {
    const cached = await getCached(cacheKey);
    if (cached !== null) return cached || null; // '' = cached miss

    const data = await yfGetWithFallback(
      `/v11/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile`
    );
    const website = data?.quoteSummary?.result?.[0]?.assetProfile?.website;
    if (website) {
      const domain = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      if (domain) {
        const url = `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=64`;
        await setCached(cacheKey, url, 7 * 86400);
        return url;
      }
    }
    await setCached(cacheKey, '', 7 * 86400); // negative cache
    return null;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, q } = req.query;
  if (!q || !type) return res.status(400).json({ error: 'Missing type or q' });

  try {
    if (type === 'stock') {
      const data = await yfGetWithFallback(
        `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false`
      );
      const quotes = (data?.quotes || [])
        .filter(r => r.quoteType !== 'OPTION' && r.quoteType !== 'FUTURE')
        .slice(0, 6);

      // Enrich each result with logoUrl from assetProfile.website (parallel, cached)
      const results = await Promise.all(quotes.map(async r => ({
        symbol:   r.symbol,
        name:     r.shortname || r.longname || r.symbol,
        exchange: r.exchDisp || r.exchange || '',
        type:     r.quoteType || '',
        logoUrl:  await fetchLogoUrl(r.symbol),
      })));

      return res.json(results);
    }

    if (type === 'crypto') {
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
      const data = await resp.json();
      const results = (data?.coins || []).slice(0, 8).map(c => ({
        id:     c.id,
        name:   c.name,
        symbol: c.symbol.toUpperCase(),
        thumb:  c.thumb || '',
        rank:   c.market_cap_rank,
      }));
      return res.json(results);
    }

    if (type === 'divinfo') {
      const data = await yfGetWithFallback(
        `/v10/finance/quoteSummary/${encodeURIComponent(q)}?modules=summaryDetail`
      );
      const sd = data?.quoteSummary?.result?.[0]?.summaryDetail || {};

      const yieldRaw = sd.dividendYield?.raw;
      const rateRaw  = sd.dividendRate?.raw;
      const exDate   = sd.exDividendDate?.fmt || null;

      return res.json({
        divYield:  yieldRaw != null ? parseFloat((yieldRaw * 100).toFixed(3)) : null,
        divRate:   rateRaw  != null ? parseFloat(rateRaw.toFixed(4))          : null,
        exDivDate: exDate,
      });
    }

    return res.status(400).json({ error: 'type must be "stock", "crypto", or "divinfo"' });
  } catch (err) {
    console.error('[search]', type, q, err.message);
    return res.status(500).json({ error: err.message });
  }
};
