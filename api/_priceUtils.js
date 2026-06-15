// Uses native fetch (Node 18) — no axios dependency needed in Vercel Functions
const { getCached, setCached } = require('./_cache');

const CRYPTO_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', XRP: 'ripple', DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', MATIC: 'matic-network', LINK: 'chainlink',
  UNI: 'uniswap', LTC: 'litecoin', BCH: 'bitcoin-cash', ATOM: 'cosmos',
  NEAR: 'near', ALGO: 'algorand', XLM: 'stellar', TRX: 'tron',
  SUI: 'sui', OP: 'optimism', ARB: 'arbitrum', SHIB: 'shiba-inu',
  PEPE: 'pepe', TON: 'the-open-network', WIF: 'dogwifcoin',
  // Extended — symbols where Yahoo Finance returns wrong data
  FET: 'fetch-ai', EGLD: 'elrond-erd-2', INJ: 'injective-protocol', AAVE: 'aave',
};

const cache = {};
const isinCache = {};         // ISIN → Yahoo ticker, 24h TTL
const CACHE_TTL  = 60_000;
const ISIN_TTL   = 86_400_000;
const EURUSD_TTL = 300_000;
const YF_UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ISIN_RE    = /^[A-Z]{2}[A-Z0-9]{10}$/;

function isIsin(key) { return ISIN_RE.test(key); }

const YF_HEADERS = {
  'User-Agent': YF_UA,
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function yfGet(url) {
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} — ${url}`);
  return res.json();
}

async function yfGetWithFallback(pathAndQuery) {
  try {
    return await yfGet(`https://query1.finance.yahoo.com${pathAndQuery}`);
  } catch (err) {
    console.warn('[prices] query1 failed, falling back to query2 —', err.message);
    return await yfGet(`https://query2.finance.yahoo.com${pathAndQuery}`);
  }
}

async function getEURUSD() {
  const now = Date.now();
  if (cache['__eurusd'] && now - cache['__eurusd'].ts < EURUSD_TTL) return cache['__eurusd'].rate;
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (rate) cache['__eurusd'] = { rate, ts: now };
    return rate || 1.08;
  } catch (err) {
    console.warn('[prices] EURUSD fetch failed, using 1.08 —', err.message);
    return 1.08;
  }
}

async function resolveCoinGeckoId(symbol) {
  if (CRYPTO_MAP[symbol]) return CRYPTO_MAP[symbol];

  const redisKey = `cgid:${symbol}`;
  const cached = await getCached(redisKey);
  if (cached) return cached;

  const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`CoinGecko search HTTP ${res.status} for ${symbol}`);
  const data = await res.json();
  const coinId = data?.coins?.[0]?.id;
  if (!coinId) throw new Error(`CoinGecko: symbol ${symbol} not found`);

  await setCached(redisKey, coinId, 86400);
  return coinId;
}

async function fetchCrypto(ticker) {
  const coinId = await resolveCoinGeckoId(ticker);
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status} for ${ticker}`);
  const data = await res.json();
  const price = data[coinId]?.eur;
  if (price == null) throw new Error(`CoinGecko: no EUR price for ${coinId}`);
  return { price, source: 'CoinGecko' };
}

async function fetchStock(ticker) {
  const data = await yfGetWithFallback(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
  );
  const result   = data?.chart?.result?.[0];
  const price    = result?.meta?.regularMarketPrice;
  const currency = result?.meta?.currency || 'USD';
  if (price == null) throw new Error(`Yahoo Finance: no price for ${ticker}`);

  let priceEur = price;
  if (currency === 'USD') {
    const eurusd = await getEURUSD();
    priceEur = price / eurusd;
  }
  return { price: priceEur, source: 'Yahoo Finance' };
}

// Try ISIN directly on Yahoo, then search API for symbol resolution
async function isinToTicker(isin) {
  const now = Date.now();
  if (isinCache[isin] && now - isinCache[isin].ts < ISIN_TTL) {
    return isinCache[isin].ticker;
  }

  // Step 1 — ISIN directly (works on some exchanges)
  try {
    const data = await yfGetWithFallback(
      `/v8/finance/chart/${isin}?interval=1d&range=1d`
    );
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price != null) {
      isinCache[isin] = { ticker: isin, ts: now };
      return isin;
    }
  } catch {}

  // Step 2 — Yahoo Finance search: ISIN → symbol
  const search = await yfGet(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=1&newsCount=0`
  );
  const symbol = search?.quotes?.[0]?.symbol;
  if (!symbol) throw new Error(`ISIN ${isin} introuvable sur Yahoo Finance`);

  isinCache[isin] = { ticker: symbol, ts: now };
  return symbol;
}

async function resolvePrice(ticker) {
  const now = Date.now();
  if (cache[ticker] && now - cache[ticker].ts < CACHE_TTL) return cache[ticker];

  const redisKey = `price:${ticker}`;
  const hit = await getCached(redisKey);
  if (hit) { cache[ticker] = hit; return hit; }

  const result = CRYPTO_MAP[ticker]
    ? await fetchCrypto(ticker)
    : await fetchStock(ticker);

  const entry = { ...result, ticker, ts: now };
  if (result.price != null) {
    cache[ticker] = entry;
    await setCached(redisKey, entry, 300);
  }
  return entry;
}

// Accepts either a ticker (BTC, CW8.PA, AAPL) or an ISIN (IE00B4L5Y983)
async function resolvePriceByKey(key) {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) return cache[key];

  if (isIsin(key)) {
    const redisKey = `price:${key}`;
    const hit = await getCached(redisKey);
    if (hit) { cache[key] = hit; return hit; }

    const resolvedTicker = await isinToTicker(key);
    const result = await fetchStock(resolvedTicker);
    const entry = { ...result, ticker: key, resolvedTicker, ts: now };
    if (result.price != null) {
      cache[key] = entry;
      await setCached(redisKey, entry, 300);
    }
    return entry;
  }

  // Regular ticker — crypto or stock (resolvePrice handles its own Redis cache)
  return resolvePrice(key);
}

module.exports = { resolvePrice, resolvePriceByKey, resolveCoinGeckoId, CRYPTO_MAP, isinToTicker, yfGet, yfGetWithFallback, YF_UA };
