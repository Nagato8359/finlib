const { resolvePriceByKey, CRYPTO_MAP, isinToTicker, yfGetWithFallback } = require('./_priceUtils');
const { supabaseAdmin, supabaseAnon } = require('./_supabase');
const supabaseModule = require('./_supabase');
const { getCached, setCached } = require('./_cache');

// ── Shared constants ──────────────────────────────────────────────────────────
const FIFTEEN_MIN = 15 * 60 * 1000;
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;

const UNSUPPORTED_TICKERS = [
  'REALT', 'REALT.',
  'SCPI', 'OPCI', 'SCI',
  'GFI', 'GFV',
  'PER',
];

// ── action=performance ────────────────────────────────────────────────────────
const PERF_TF = {
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

async function handlePerformance(req, res) {
  const { key, tf } = req.query;
  const tfParams = PERF_TF[tf];
  if (!key || !tfParams) return res.status(400).json({ error: 'Missing or invalid params' });

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const upperKey = key.toUpperCase();
    if (upperKey.startsWith('REALTOKEN') || key.startsWith('realtoken')) {
      return res.status(200).json({ change_pct: 0, price: null, skipped: true });
    }
    if (UNSUPPORTED_TICKERS.includes(upperKey)) {
      return res.json({ changePct: 0, key, tf, unsupported: true });
    }
    const cacheKey = `price:${upperKey}:${tf}`;
    const cached = await getCached(cacheKey);
    if (cached != null) return res.json({ changePct: cached, key, tf });
    if (tf === '1J') {
      const { data: row } = await supabaseAnon
        .from('prices_cache')
        .select('change_pct, updated_at')
        .eq('ticker', upperKey)
        .maybeSingle();
      if (row?.change_pct != null && row?.updated_at) {
        const ageMs = Date.now() - new Date(row.updated_at).getTime();
        if (ageMs < 3_600_000) {
          const result = parseFloat(Number(row.change_pct).toFixed(3));
          await setCached(cacheKey, result, 900);
          return res.json({ changePct: result, key, tf });
        }
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
    try {
      supabaseModule.supabaseAdmin
        .from('prices_cache')
        .upsert(
          { ticker: upperKey, change_pct: result, updated_at: new Date().toISOString() },
          { onConflict: 'ticker' }
        )
        .then(({ error }) => {
          if (error) console.error('[prices] performance prices_cache write:', error.message);
        });
    } catch {}
    return res.json({ changePct: result, key, tf });
  } catch (err) {
    console.error('[prices] performance', key, tf, err.message);
    return res.status(502).json({ error: err.message });
  }
}

// ── action=news ───────────────────────────────────────────────────────────────
const NEWS_FEED_URL = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,BTC-EUR&region=fr&lang=fr-FR';
const NEWS_CACHE_KEY = 'news:fr';
const NEWS_CACHE_TTL = 900;

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'");
}

function extractRssTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) val = cdata[1].trim();
  return decodeXmlEntities(val);
}

function parseRssItems(xml, limit) {
  const blocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  const items = [];
  for (const block of blocks.slice(0, limit)) {
    const title = extractRssTag(block, 'title');
    const url = extractRssTag(block, 'link');
    if (!title || !url) continue;
    const pubDate = extractRssTag(block, 'pubDate');
    let source = '';
    try { source = new URL(url).hostname.replace(/^(fr\.|www\.)/, ''); } catch {}
    items.push({
      title,
      description: extractRssTag(block, 'description'),
      url,
      publishedAt: pubDate && !isNaN(new Date(pubDate)) ? new Date(pubDate).toISOString() : null,
      source,
      image: null,
    });
  }
  return items;
}

async function handleNews(res) {
  try {
    const cached = await getCached(NEWS_CACHE_KEY);
    if (cached) return res.json({ items: cached, cached: true });
    const rssRes = await fetch(NEWS_FEED_URL, { signal: AbortSignal.timeout(8000) });
    if (!rssRes.ok) throw new Error(`Yahoo RSS HTTP ${rssRes.status}`);
    const xml = await rssRes.text();
    const items = parseRssItems(xml, 20);
    await setCached(NEWS_CACHE_KEY, items, NEWS_CACHE_TTL);
    res.json({ items, cached: false });
  } catch (err) {
    console.error('[prices] news error:', err.message);
    res.status(502).json({ error: err.message, items: [] });
  }
}

// ── action=search ─────────────────────────────────────────────────────────────
const LOGO_DEV_TOKEN = 'pk_X4dPbXQbTBuiGqrJH9u8VA';

async function handleSearch(req, res) {
  const { type, q } = req.query;
  if (!q || !type) return res.status(400).json({ error: 'Missing type or q' });
  try {
    if (type === 'stock') {
      const data = await yfGetWithFallback(
        `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false`
      );
      const quotes = (data?.quotes || [])
        .filter(r => r.quoteType !== 'OPTION' && r.quoteType !== 'FUTURE')
        .slice(0, 6);
      return res.json(quotes.map(r => {
        const base = r.symbol.split('.')[0].toUpperCase();
        return {
          symbol:   r.symbol,
          name:     r.shortname || r.longname || r.symbol,
          exchange: r.exchDisp || r.exchange || '',
          type:     r.quoteType || '',
          logoUrl:  `https://img.logo.dev/?ticker=${base}&token=${LOGO_DEV_TOKEN}&size=64`,
        };
      }));
    }
    if (type === 'crypto') {
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
      const data = await resp.json();
      return res.json((data?.coins || []).slice(0, 8).map(c => ({
        id:     c.id,
        name:   c.name,
        symbol: c.symbol.toUpperCase(),
        thumb:  c.thumb || '',
        rank:   c.market_cap_rank,
      })));
    }
    if (type === 'divinfo') {
      const data = await yfGetWithFallback(
        `/v10/finance/quoteSummary/${encodeURIComponent(q)}?modules=summaryDetail`
      );
      const sd = data?.quoteSummary?.result?.[0]?.summaryDetail || {};
      return res.json({
        divYield:  sd.dividendYield?.raw != null ? parseFloat((sd.dividendYield.raw * 100).toFixed(3)) : null,
        divRate:   sd.dividendRate?.raw  != null ? parseFloat(sd.dividendRate.raw.toFixed(4))          : null,
        exDivDate: sd.exDividendDate?.fmt || null,
      });
    }
    return res.status(400).json({ error: 'type must be "stock", "crypto", or "divinfo"' });
  } catch (err) {
    console.error('[prices] search', type, q, err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── action=intraday ───────────────────────────────────────────────────────────
async function fetchEURUSDHourly() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1h&range=1d');
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes     = result?.indicators?.quote?.[0]?.close || [];
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
  const closes     = result.indicators?.quote?.[0]?.close || [];
  const currency   = result.meta?.currency || 'USD';
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

function priceAt(series, ts) {
  let val = null;
  for (const p of series) {
    if (p.ts > ts) break;
    if (p.price != null) val = p.price;
  }
  return val;
}

async function handleIntraday(req, res) {
  const body      = req.body || {};
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
    const ts    = now - h * 3600000;
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

  const hasInv = uniqueKeys.length > 0;
  const pts    = hasInv
    ? rawPoints.filter(p => p.Patrimoine > Math.round(baseValue))
    : rawPoints;
  const result    = pts.length > 0 ? pts : rawPoints;
  const openValue = result[0]?.Patrimoine || 0;

  res.json({ points: result.map(p => ({ ...p, open: openValue })) });
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // action=intraday accepts POST
  if (action === 'intraday') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleIntraday(req, res);
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'news') {
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return handleNews(res);
  }
  if (action === 'performance') return handlePerformance(req, res);
  if (action === 'search')      return handleSearch(req, res);

  // ── default: batch price lookup from prices_cache ─────────────────────────
  const keys = String(req.query.tickers || '')
    .split(',')
    .map(k => k.trim().toUpperCase())
    .filter(Boolean);

  if (!keys.length) return res.status(400).json({ error: 'Missing tickers' });

  const { data: cachedRows } = await supabaseAdmin
    .from('prices_cache')
    .select('ticker, price, updated_at')
    .or(keys.map(k => `ticker.ilike.${k}`).join(','));

  const now = Date.now();
  const out = {};
  for (const row of cachedRows || []) {
    if (now - new Date(row.updated_at).getTime() < FIFTEEN_MIN) {
      out[row.ticker.toUpperCase()] = row.price;
    }
  }

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
