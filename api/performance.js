const { CRYPTO_MAP, isinToTicker, yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');
const { supabaseAnon } = require('./_supabase');

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;

const TF = {
  '1J':  { range: '1d',  interval: '5m',  days: 1   },
  '1S':  { range: '5d',  interval: '1h',  days: 7   },
  '1M':  { range: '1mo', interval: '1d',  days: 30  },
  '3M':  { range: '3mo', interval: '1d',  days: 90  },
  '1AN': { range: '1y',  interval: '1wk', days: 365 },
};

async function yfChangePct(ticker, range, interval) {
  const data = await yfGetWithFallback(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`
  );
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo result for ${ticker}`);

  // 1d range: use meta previousClose vs regularMarketPrice for accuracy
  if (range === '1d') {
    const open  = result.meta?.chartPreviousClose ?? result.meta?.previousClose;
    const close = result.meta?.regularMarketPrice;
    if (open && close && open !== 0) return ((close - open) / open) * 100;
  }

  const closes = result.indicators?.quote?.[0]?.close?.filter(c => c != null);
  if (!closes || closes.length < 2) throw new Error(`Insufficient data for ${ticker}`);
  return ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
}

async function geckoChangePct(coinId, days) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status} for ${coinId}`);
  const data = await res.json();
  const prices = data.prices;
  if (!prices || prices.length < 2) throw new Error(`Insufficient CoinGecko data for ${coinId}`);
  return ((prices[prices.length - 1][1] - prices[0][1]) / prices[0][1]) * 100;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { key, tf } = req.query;
  const tfParams = TF[tf];
  if (!key || !tfParams) return res.status(400).json({ error: 'Missing or invalid params' });

  // Cache 5 min on Vercel CDN
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const upperKey = key.toUpperCase();
    const cacheKey = `price:${upperKey}:${tf}`;

    const cached = await getCached(cacheKey);
    if (cached != null) return res.json({ changePct: cached, key, tf });

    // For 1J (intraday), read from Supabase prices_cache populated by the hourly cron.
    // Longer timeframes still call Yahoo Finance — prices_cache only stores 1d change_pct.
    if (tf === '1J') {
      const { data: row } = await supabaseAnon
        .from('prices_cache')
        .select('change_pct')
        .eq('ticker', upperKey)
        .maybeSingle();
      if (row?.change_pct != null) {
        const result = parseFloat(Number(row.change_pct).toFixed(3));
        await setCached(cacheKey, result, 900);
        return res.json({ changePct: result, key, tf });
      }
    }

    let changePct;
    if (CRYPTO_MAP[upperKey]) {
      changePct = await geckoChangePct(CRYPTO_MAP[upperKey], tfParams.days);
    } else {
      let ticker = upperKey;
      if (ISIN_RE.test(upperKey)) ticker = await isinToTicker(upperKey);
      changePct = await yfChangePct(ticker, tfParams.range, tfParams.interval);
    }

    const result = parseFloat(changePct.toFixed(3));
    await setCached(cacheKey, result, tf === '1J' ? 900 : 3600);
    res.json({ changePct: result, key, tf });
  } catch (err) {
    console.error('[performance]', key, tf, err.message);
    res.status(502).json({ error: err.message });
  }
};
