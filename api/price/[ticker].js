const { resolvePrice } = require('../_priceUtils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const data = await resolvePrice(ticker);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, ticker });
  }
};
