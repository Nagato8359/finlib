// GET /api/dividends?tickers=AAPL,TTE,BNP
// Reads from dividend_events Supabase table.
// Falls back to Yahoo Finance (with auto-resolved suffix via search API) if ticker has no rows.
const { supabaseAdmin } = require('./_supabase');
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

// Resolve the canonical Yahoo Finance symbol (with exchange suffix) via search API.
// BNP → BNP.PA, TTE → TTE.PA, ASML → ASML.AS, etc.
// Cached 30 days. Empty string cached as negative (use raw ticker).
async function resolveYahooSymbol(ticker) {
  const cacheKey = `yticker:${ticker}`;
  try {
    const cached = await getCached(cacheKey);
    if (cached !== null) return cached || ticker;

    const data = await yfGetWithFallback(
      `/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0&enableFuzzyQuery=false`
    );
    const symbol = data?.quotes?.[0]?.symbol;
    if (symbol) {
      await setCached(cacheKey, symbol, 30 * 86400);
      return symbol;
    }
    await setCached(cacheKey, '', 30 * 86400);
    return ticker;
  } catch {
    return ticker;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: 'Missing tickers param' });

  const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 25);
  const output = {};

  // 1. Read from Supabase dividend_events
  try {
    const { data: rows, error: dbErr } = await supabaseAdmin
      .from('dividend_events')
      .select('ticker, ex_date, payment_date, amount, currency, amount_eur, status, source')
      .in('ticker', tickerList)
      .order('ex_date', { ascending: true });

    if (!dbErr && rows?.length) {
      const byTicker = {};
      for (const row of rows) {
        (byTicker[row.ticker] = byTicker[row.ticker] || []).push(row);
      }
      for (const ticker of tickerList) {
        const events = byTicker[ticker];
        if (!events?.length) continue;
        const confirmedDates = events
          .filter(e => e.status === 'confirmed')
          .map(e => new Date(e.ex_date));
        const frequency = detectFrequency(confirmedDates);
        output[ticker] = {
          events: events.map(e => ({
            exDate:    e.ex_date,
            payDate:   e.payment_date || null,
            amount:    e.amount,
            amountEUR: e.amount_eur ?? e.amount,
            currency:  e.currency || 'USD',
            status:    e.status,
            source:    e.source || 'yahoo',
          })),
          frequency,
          annualYield: null,
        };
      }
    }
  } catch (e) {
    console.error('[dividends] Supabase read:', e.message);
  }

  // 2. Fallback to Yahoo Finance for tickers with no Supabase data
  const missing = tickerList.filter(t => !output[t]);
  if (missing.length) {
    const eurusd = await getEURUSD();

    // Resolve all missing tickers to their canonical Yahoo symbols in parallel
    const resolved = await Promise.all(missing.map(async t => [t, await resolveYahooSymbol(t)]));

    await Promise.allSettled(resolved.map(async ([ticker, yfSymbol]) => {
      try {
        const cacheKey = `div2:${ticker}`;
        const cached = await getCached(cacheKey);
        if (cached) { output[ticker] = cached; return; }

        const data = await yfGetWithFallback(
          `/v8/finance/chart/${encodeURIComponent(yfSymbol)}?events=dividends&range=2y&interval=1mo`
        );
        const result = data?.chart?.result?.[0];
        if (!result) {
          output[ticker] = { events: [], frequency: null, annualYield: null };
          return;
        }

        const currency = result.meta?.currency || 'USD';
        const currentPrice = result.meta?.regularMarketPrice || null;
        const toEUR = currency === 'EUR' ? 1 : 1 / eurusd;
        const divEvents = result.events?.dividends || {};
        const sorted = Object.values(divEvents).sort((a, b) => a.date - b.date);

        const events = sorted.map(e => ({
          exDate:    new Date(e.date * 1000).toISOString().slice(0, 10),
          payDate:   null,
          amount:    Math.round(e.amount * 1e6) / 1e6,
          amountEUR: Math.round(e.amount * toEUR * 1e6) / 1e6,
          currency,
          status:    'confirmed',
          source:    'yahoo',
        }));

        const frequency = detectFrequency(events.map(e => new Date(e.exDate)));

        if (events.length > 0) {
          const last = events[events.length - 1];
          const nextMs = new Date(last.exDate).getTime() + FREQ_DAYS[frequency] * 86400000;
          if (nextMs > Date.now()) {
            events.push({
              exDate:    new Date(nextMs).toISOString().slice(0, 10),
              payDate:   null,
              amount:    last.amount,
              amountEUR: last.amountEUR,
              currency,
              status:    'estimated',
              source:    'estimated',
            });
          }
        }

        const cutoffMs = Date.now() - 365 * 86400000;
        const annualAmt = sorted.filter(e => e.date * 1000 > cutoffMs).reduce((s, e) => s + e.amount, 0);
        const annualYield = currentPrice && annualAmt > 0
          ? Math.round((annualAmt / currentPrice) * 10000) / 100
          : null;

        const payload = { events, frequency, annualYield };
        await setCached(cacheKey, payload, 86400);
        output[ticker] = payload;
      } catch (e) {
        console.error(`[dividends] Yahoo fallback ${ticker} (${yfSymbol}):`, e.message);
      }
    }));
  }

  return res.json(output);
};
