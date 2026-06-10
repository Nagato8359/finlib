const { resolvePriceByKey } = require('./_priceUtils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const keys = String(req.query.tickers || '')
    .split(',')
    .map(k => k.trim().toUpperCase())
    .filter(Boolean);

  if (!keys.length) return res.status(400).json({ error: 'Missing tickers' });

  const out = {};
  await Promise.allSettled(
    keys.map(async key => {
      try {
        const data = await resolvePriceByKey(key);
        if (data.price != null) out[key] = data.price;
      } catch {}
    })
  );

  res.json(out);
};
