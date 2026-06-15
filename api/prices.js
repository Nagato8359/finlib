const { resolvePriceByKey } = require('./_priceUtils');
const { supabaseAdmin } = require('./_supabase');

const FIFTEEN_MIN = 15 * 60 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const keys = String(req.query.tickers || '')
    .split(',')
    .map(k => k.trim().toUpperCase())
    .filter(Boolean);

  if (!keys.length) return res.status(400).json({ error: 'Missing tickers' });

  // ── 1. Batch read from prices_cache (cron keeps this fresh) ──────────────
  const { data: cached } = await supabaseAdmin
    .from('prices_cache')
    .select('ticker, price, updated_at')
    .or(keys.map(k => `ticker.ilike.${k}`).join(','));

  const now = Date.now();
  const out = {};
  for (const row of cached || []) {
    if (now - new Date(row.updated_at).getTime() < FIFTEEN_MIN) {
      out[row.ticker.toUpperCase()] = row.price;
    }
  }

  // ── 2. Fallback to Yahoo Finance for stale / missing keys ─────────────────
  const stale = keys.filter(k => !(k in out));
  if (stale.length) {
    await Promise.allSettled(
      stale.map(async key => {
        try {
          const data = await resolvePriceByKey(key);
          if (data.price != null) out[key] = data.price;
          else console.warn(`[prices] null price for ${key}`);
        } catch (err) {
          console.error(`[prices] error for ${key}:`, err.message);
        }
      })
    );
  }

  res.json(out);
};
