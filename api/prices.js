const { resolvePrice } = require('./_priceUtils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const tickers = String(req.query.tickers || '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  if (!tickers.length) return res.status(400).json({ error: 'Missing tickers' });

  const out = {};
  await Promise.allSettled(
    tickers.map(async ticker => {
      try {
        const data = await resolvePrice(ticker);
        if (data.price != null) out[ticker] = data.price;
      } catch {}
    })
  );

  res.json(out);
};
