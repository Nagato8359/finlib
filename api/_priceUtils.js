// Uses native fetch (Node 18) — no axios dependency needed in Vercel Functions

const CRYPTO_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', XRP: 'ripple', DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', MATIC: 'matic-network', LINK: 'chainlink',
  UNI: 'uniswap', LTC: 'litecoin', BCH: 'bitcoin-cash', ATOM: 'cosmos',
  NEAR: 'near', ALGO: 'algorand', XLM: 'stellar', TRX: 'tron',
  SUI: 'sui', OP: 'optimism', ARB: 'arbitrum', SHIB: 'shiba-inu',
  PEPE: 'pepe', TON: 'the-open-network', WIF: 'dogwifcoin',
};

const cache = {};
const isinCache = {};         // ISIN → Yahoo ticker, 24h TTL
const CACHE_TTL  = 60_000;
const ISIN_TTL   = 86_400_000;
const EURUSD_TTL = 300_000;
const YF_UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const ISIN_RE    = /^[A-Z]{2}[A-Z0-9]{10}$/;

function isIsin(key) { return ISIN_RE.test(key); }

async function yfGet(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': YF_UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} — ${url}`);
  return res.json();
}

async function getEURUSD() {
  const now = Date.now();
  if (cache['__eurusd'] && now - cache['__eurusd'].ts < EURUSD_TTL) return cache['__eurusd'].rate;
  try {
    const data = await yfGet('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (rate) cache['__eurusd'] = { rate, ts: now };
    return rate || 1.08;
  } catch (err) {
    console.warn('[prices] EURUSD fetch failed, using 1.08 —', err.message);
    return 1.08;
  }
}

async function fetchCrypto(ticker) {
  const coinId = CRYPTO_MAP[ticker];
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
  const data = await yfGet(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
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
    const data = await yfGet(
      `https://query1.finance.yahoo.com/v8/finance/chart/${isin}?interval=1d&range=1d`
    );
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price != null) {
      console.log(`[prices] ISIN ${isin} resolved directly`);
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

  console.log(`[prices] ISIN ${isin} → ${symbol}`);
  isinCache[isin] = { ticker: symbol, ts: now };
  return symbol;
}

async function resolvePrice(ticker) {
  const now = Date.now();
  if (cache[ticker] && now - cache[ticker].ts < CACHE_TTL) return cache[ticker];

  const result = CRYPTO_MAP[ticker]
    ? await fetchCrypto(ticker)
    : await fetchStock(ticker);

  const entry = { ...result, ticker, ts: now };
  if (result.price != null) cache[ticker] = entry;
  return entry;
}

// Accepts either a ticker (BTC, CW8.PA, AAPL) or an ISIN (IE00B4L5Y983)
async function resolvePriceByKey(key) {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) return cache[key];

  if (isIsin(key)) {
    const resolvedTicker = await isinToTicker(key);
    const result = await fetchStock(resolvedTicker);
    const entry = { ...result, ticker: key, resolvedTicker, ts: now };
    if (result.price != null) cache[key] = entry;
    return entry;
  }

  // Regular ticker — crypto or stock
  return resolvePrice(key);
}

module.exports = { resolvePrice, resolvePriceByKey };
