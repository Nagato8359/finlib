const { CRYPTO_MAP, isinToTicker, yfGetWithFallback } = require('./_priceUtils');

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;

async function fetchEURUSDHourly() {
  try {
    const data = await yfGetWithFallback(
      '/v8/finance/chart/EURUSD=X?interval=1h&range=1d'
    );
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const series = timestamps
      .map((t, i) => ({ ts: t * 1000, price: closes[i] }))
      .filter(p => p.price != null);
    return { series, fallback: series.at(-1)?.price ?? 1.08 };
  } catch {
    return { series: [], fallback: 1.08 };
  }
}

async function fetchYFHourly(ticker) {
  const data = await yfGetWithFallback(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1h&range=1d`
  );
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No YF intraday for ${ticker}`);
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const currency = result.meta?.currency || 'USD';
  const series = timestamps
    .map((t, i) => ({ ts: t * 1000, price: closes[i] }))
    .filter(p => p.price != null);
  return { series, currency };
}

async function fetchCGHourly(coinId) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=1`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const { prices = [] } = await res.json();
  return prices.map(([ts, price]) => ({ ts, price }));
}

// Last known price at or before ts in sorted series
function priceAt(series, ts) {
  let val = null;
  for (const p of series) {
    if (p.ts > ts) break;
    if (p.price != null) val = p.price;
  }
  return val;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const positions = Array.isArray(body.positions) ? body.positions : [];
  const baseValue = parseFloat(body.baseValue) || 0;

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const uniqueKeys = [...new Set(
    positions.map(p => (p.key || '').toUpperCase()).filter(Boolean)
  )];

  const [eurusdResult, ...keyResults] = await Promise.allSettled([
    fetchEURUSDHourly(),
    ...uniqueKeys.map(async key => {
      const coinId = CRYPTO_MAP[key];
      if (coinId) {
        const series = await fetchCGHourly(coinId);
        return { key, series, currency: 'EUR' };
      }
      const ticker = ISIN_RE.test(key) ? await isinToTicker(key) : key;
      const { series, currency } = await fetchYFHourly(ticker);
      return { key, series, currency };
    }),
  ]);

  const { series: eurusd, fallback: eurusdFB } =
    eurusdResult.status === 'fulfilled' ? eurusdResult.value : { series: [], fallback: 1.08 };

  const seriesMap = {};
  keyResults.forEach(r => {
    if (r.status !== 'fulfilled') return;
    const { key, series, currency } = r.value;
    seriesMap[key] = currency === 'USD'
      ? series.map(p => ({ ts: p.ts, price: p.price / (priceAt(eurusd, p.ts) || eurusdFB) }))
      : series;
  });

  const now = Date.now();
  const rawPoints = [];
  for (let h = 24; h >= 0; h--) {
    const ts = now - h * 3600000;
    const label = new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    let value = baseValue;
    for (const { key, shares } of positions) {
      const series = seriesMap[(key || '').toUpperCase()];
      if (!series) continue;
      const price = priceAt(series, ts);
      if (price != null) value += (parseFloat(shares) || 0) * price;
    }
    rawPoints.push({ ts, label, Patrimoine: Math.round(value) });
  }

  // Filter out pre-market points (only base value, no investment data yet)
  const hasInv = uniqueKeys.length > 0;
  const pts = hasInv
    ? rawPoints.filter(p => p.Patrimoine > Math.round(baseValue))
    : rawPoints;
  const result = pts.length > 0 ? pts : rawPoints;
  const openValue = result[0]?.Patrimoine || 0;

  res.json({ points: result.map(p => ({ ...p, open: openValue })) });
};
