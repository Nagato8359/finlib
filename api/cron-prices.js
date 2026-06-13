const { supabaseAdmin } = require('./_supabase');
const { yfGetWithFallback, CRYPTO_MAP, isinToTicker } = require('./_priceUtils');

const COMMODITY_TICKER_MAP = {
  'Or': 'GC=F', 'Argent': 'SI=F', 'Platine': 'PL=F',
  'Palladium': 'PA=F', 'Pétrole': 'CL=F', 'Cuivre': 'HG=F',
};
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;

const UNSUPPORTED_TICKERS = ['REALT', 'REALT.'];

async function getEURUSD() {
  try {
    const d = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

async function fetchStockEntry(ticker, eurusd) {
  const data = await yfGetWithFallback(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
  );
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo result for ${ticker}`);

  const { regularMarketPrice: rawPrice, currency = 'USD', chartPreviousClose, previousClose } = result.meta;
  const prevClose = chartPreviousClose ?? previousClose;
  const price = currency === 'USD' ? rawPrice / eurusd : rawPrice;
  const change_pct = prevClose && prevClose !== 0 ? ((rawPrice - prevClose) / prevClose) * 100 : null;
  return { price, change_pct };
}

async function fetchCryptoEntry(coinId) {
  const [priceRes, chartRes] = await Promise.allSettled([
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`,
      { signal: AbortSignal.timeout(8000) }
    ),
    fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=1`,
      { signal: AbortSignal.timeout(8000) }
    ),
  ]);

  let price = null;
  let change_pct = null;

  if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
    const d = await priceRes.value.json();
    price = d[coinId]?.eur ?? null;
  }
  if (chartRes.status === 'fulfilled' && chartRes.value.ok) {
    const d = await chartRes.value.json();
    const pts = d.prices;
    if (pts?.length >= 2) {
      change_pct = ((pts[pts.length - 1][1] - pts[0][1]) / pts[0][1]) * 100;
    }
  }
  return { price, change_pct };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Vercel injects CRON_SECRET automatically for scheduled invocations
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Read all investments across all users (requires service role key)
    const { data: rows, error: dbErr } = await supabaseAdmin
      .from('user_data')
      .select('investments');
    if (dbErr) throw new Error(`user_data read: ${dbErr.message}`);

    // 2. Extract unique tickers / ISINs / commodity futures
    const tickerSet = new Set();
    for (const row of rows || []) {
      for (const inv of row.investments || []) {
        for (const pos of inv.positions || []) {
          if (pos.posType === 'commodity') {
            const t = COMMODITY_TICKER_MAP[pos.commodityType];
            if (t) tickerSet.add(t);
          } else if (pos.isin) {
            tickerSet.add(pos.isin);
          } else if (pos.ticker) {
            tickerSet.add(pos.ticker);
          }
        }
      }
    }

    const keys = [...tickerSet].filter(k => !UNSUPPORTED_TICKERS.includes(k.toUpperCase()));
    if (!keys.length) return res.json({ ok: true, updated: 0, total: 0 });

    // 3. Fetch EUR/USD once for all USD-denominated assets
    const eurusd = await getEURUSD();

    // 4. Fetch price + 1d change_pct and upsert to prices_cache
    const settled = await Promise.allSettled(
      keys.map(async (key) => {
        try {
          const upper = key.toUpperCase();
          let entry;
          if (CRYPTO_MAP[upper]) {
            entry = await fetchCryptoEntry(CRYPTO_MAP[upper]);
          } else {
            const ticker = ISIN_RE.test(upper) ? await isinToTicker(upper) : upper;
            entry = await fetchStockEntry(ticker, eurusd);
          }

          if (entry.price == null) return { key, ok: false };

          const { error: upsErr } = await supabaseAdmin.from('prices_cache').upsert({
            ticker: key,
            price:      parseFloat(entry.price.toFixed(4)),
            change_pct: entry.change_pct != null ? parseFloat(entry.change_pct.toFixed(3)) : null,
            currency:   'EUR',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'ticker' });

          if (upsErr) console.error(`[cron] upsert ${key}:`, upsErr.message);
          return { key, ok: !upsErr };
        } catch (e) {
          console.error(`[cron] ${key}:`, e.message);
          return { key, ok: false };
        }
      })
    );

    const updated = settled.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
    console.log(`[cron-prices] ${updated}/${keys.length} tickers refreshed`);
    res.json({ ok: true, updated, total: keys.length });
  } catch (err) {
    console.error('[cron-prices] fatal:', err.message);
    res.status(500).json({ error: err.message });
  }
};
