// GET /api/dividends?tickers=AAPL,TTE,BNP
// Returns Yahoo Finance dividend history + projected next dividend per ticker
// Cache: Redis 24h per ticker
const { getCached, setCached } = require('./_cache');
const { yfGetWithFallback } = require('./_priceUtils');

async function getEURUSD() {
  try {
    const d = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

function detectFrequency(sortedDates) {
  if (sortedDates.length < 2) return 'annuel';
  const gaps = [];
  for (let i = 1; i < sortedDates.length; i++) {
    gaps.push((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / 86400000);
  }
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  if (avg < 45)  return 'mensuel';
  if (avg < 110) return 'trimestriel';
  if (avg < 250) return 'semestriel';
  return 'annuel';
}

const FREQ_DAYS = { mensuel: 30, trimestriel: 91, semestriel: 183, annuel: 365 };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: 'Missing tickers param' });

  const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 25);
  const eurusd = await getEURUSD();

  const settled = await Promise.allSettled(tickerList.map(async ticker => {
    const cacheKey = `div2:${ticker}`;
    const cached = await getCached(cacheKey);
    if (cached) return [ticker, cached];

    const data = await yfGetWithFallback(
      `/v8/finance/chart/${encodeURIComponent(ticker)}?events=dividends&range=2y&interval=1mo`
    );
    const result = data?.chart?.result?.[0];
    if (!result) {
      return [ticker, { dividends: [], nextDividend: null, frequency: null, annualYield: null }];
    }

    const currency = result.meta?.currency || 'USD';
    const currentPrice = result.meta?.regularMarketPrice || null;
    const toEUR = currency === 'EUR' ? 1 : 1 / eurusd;

    const divEvents = result.events?.dividends || {};
    const dividends = Object.values(divEvents)
      .sort((a, b) => a.date - b.date)
      .map(e => ({
        exDate:    new Date(e.date * 1000).toISOString().slice(0, 10),
        payDate:   null,
        amount:    Math.round(e.amount * 1e6) / 1e6,
        amountEUR: Math.round(e.amount * toEUR * 1e6) / 1e6,
        currency,
      }));

    const sortedDates = dividends.map(d => new Date(d.exDate));
    const frequency = detectFrequency(sortedDates);

    // Trailing-12-month yield
    const cutoffMs = Date.now() - 365 * 86400000;
    const annualAmt = Object.values(divEvents)
      .filter(e => e.date * 1000 > cutoffMs)
      .reduce((s, e) => s + e.amount, 0);
    const annualYield = currentPrice && annualAmt > 0
      ? Math.round((annualAmt / currentPrice) * 10000) / 100
      : null;

    // Projected next dividend from last known + frequency gap
    let nextDividend = null;
    if (dividends.length > 0) {
      const last = dividends[dividends.length - 1];
      const nextMs = new Date(last.exDate).getTime() + FREQ_DAYS[frequency] * 86400000;
      if (nextMs > Date.now()) {
        nextDividend = {
          exDate:    new Date(nextMs).toISOString().slice(0, 10),
          payDate:   null,
          amount:    last.amount,
          amountEUR: last.amountEUR,
          currency,
          estimated: true,
        };
      }
    }

    const payload = { dividends, nextDividend, frequency, annualYield };
    await setCached(cacheKey, payload, 86400);
    return [ticker, payload];
  }));

  const output = {};
  settled.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      const [ticker, payload] = r.value;
      output[ticker] = payload;
    }
  });

  return res.json(output);
};
