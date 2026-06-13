// Proxy CORS-safe search: Yahoo Finance (stocks/ISIN) and CoinGecko (crypto)
const { yfGetWithFallback } = require('./_priceUtils');

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
      const results = (data?.quotes || [])
        .filter(r => r.quoteType !== 'OPTION' && r.quoteType !== 'FUTURE')
        .slice(0, 6)
        .map(r => ({
          symbol:   r.symbol,
          name:     r.shortname || r.longname || r.symbol,
          exchange: r.exchDisp || r.exchange || '',
          type:     r.quoteType || '',
        }));
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
