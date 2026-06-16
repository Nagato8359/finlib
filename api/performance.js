const { CRYPTO_MAP, isinToTicker, yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');
const { supabaseAnon } = require('./_supabase');
const supabaseModule = require('./_supabase');

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;

const UNSUPPORTED_TICKERS = [
  'REALT', 'REALT.',                    // RealT tokens
  'SCPI', 'OPCI', 'SCI',               // Pierre-papier
  'GFI', 'GFV',                         // Forêts / Vignes
  'PER',                                 // Plan Épargne Retraite
];

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

// ── News (folded in here rather than a new api/news.js — we're already at the
// 12-function cap on the Vercel Hobby plan) ─────────────────────────────────
const NEWS_FEED_URL = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,BTC-EUR&region=fr&lang=fr-FR';
const NEWS_CACHE_KEY = 'news:fr';
const NEWS_CACHE_TTL = 900; // 15 min

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
    console.error('[performance] news error:', err.message);
    res.status(502).json({ error: err.message, items: [] });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'news') {
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return handleNews(res);
  }

  const { key, tf } = req.query;
  const tfParams = TF[tf];
  if (!key || !tfParams) return res.status(400).json({ error: 'Missing or invalid params' });

  // Cache 5 min on Vercel CDN
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

    // L1: Redis cache (per-TF key, short TTL)
    const cached = await getCached(cacheKey);
    if (cached != null) return res.json({ changePct: cached, key, tf });

    // L2: Supabase prices_cache — this column only ever holds the 1-day change
    // (written by cron-prices.js), so it can only ever short-circuit tf=1J.
    // Using it for other timeframes was returning the daily change for every tf.
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

    // L3: Yahoo Finance / CoinGecko fallback
    let changePct;
    if (CRYPTO_MAP[upperKey]) {
      changePct = await geckoChangePct(CRYPTO_MAP[upperKey], tfParams.days);
    } else {
      let ticker = upperKey;
      if (ISIN_RE.test(upperKey)) ticker = await isinToTicker(upperKey);
      changePct = await yfChangePct(ticker, tfParams.range, tfParams.interval);
    }

    const result = parseFloat(changePct.toFixed(3));

    // Store in Redis
    await setCached(cacheKey, result, tf === '1J' ? 900 : 3600);

    // Write-through to prices_cache (fire-and-forget, uses admin to bypass RLS)
    try {
      supabaseModule.supabaseAdmin
        .from('prices_cache')
        .upsert(
          { ticker: upperKey, change_pct: result, updated_at: new Date().toISOString() },
          { onConflict: 'ticker' }
        )
        .then(({ error }) => {
          if (error) console.error('[performance] prices_cache write:', error.message);
        });
    } catch {
      // supabaseAdmin unavailable (SUPABASE_SERVICE_ROLE_KEY not set) — skip cache write
    }

    res.json({ changePct: result, key, tf });
  } catch (err) {
    console.error('[performance]', key, tf, err.message);
    res.status(502).json({ error: err.message });
  }
};
