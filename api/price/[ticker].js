const { resolvePriceByKey } = require('../_priceUtils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = String(req.query.ticker || '').trim().toUpperCase();
  if (!key) return res.status(400).json({ error: 'Missing ticker or ISIN' });

  try {
    const data = await resolvePriceByKey(key);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, key });
  }
};
