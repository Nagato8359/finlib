const axios = require('axios');

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
const isinCache = {}; // ISIN → Yahoo ticker, 24h TTL
const CACHE_TTL   = 60_000;
const ISIN_TTL    = 86_400_000; // 24h — ticker mappings don't change
const EURUSD_TTL  = 300_000;
const YF_HEADERS  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const ISIN_RE     = /^[A-Z]{2}[A-Z0-9]{10}$/;

function isIsin(key) {
  return ISIN_RE.test(key);
}

async function getEURUSD() {
  const now = Date.now();
  if (cache['__eurusd'] && now - cache['__eurusd'].ts < EURUSD_TTL) return cache['__eurusd'].rate;
  try {
    const { data } = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d',
      { timeout: 8000, headers: YF_HEADERS }
    );
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (rate) cache['__eurusd'] = { rate, ts: now };
    return rate || 1.08;
  } catch {
    return 1.08;
  }
}

async function fetchCrypto(ticker) {
  const coinId = CRYPTO_MAP[ticker];
  const { data } = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`,
    { timeout: 8000 }
  );
  return { price: data[coinId]?.eur, source: 'CoinGecko' };
}

async function fetchStock(ticker) {
  const { data } = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
    { timeout: 8000, headers: YF_HEADERS }
  );
  const result = data?.chart?.result?.[0];
  const price    = result?.meta?.regularMarketPrice;
  const currency = result?.meta?.currency || 'USD';

  let priceEur = price;
  if (currency === 'USD' && price) {
    const eurusd = await getEURUSD();
    priceEur = price / eurusd;
  }
  return { price: priceEur, source: 'Yahoo Finance' };
}

// Step 1: try ISIN directly on Yahoo Finance
// Step 2: fallback to Yahoo Finance search (ISIN → ticker symbol)
async function isinToTicker(isin) {
  const now = Date.now();
  if (isinCache[isin] && now - isinCache[isin].ts < ISIN_TTL) return isinCache[isin].ticker;

  // Direct attempt — some ISINs work as-is on Yahoo (e.g. exchange-specific codes)
  try {
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${isin}?interval=1d&range=1d`,
      { timeout: 8000, headers: YF_HEADERS }
    );
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price != null) {
      isinCache[isin] = { ticker: isin, ts: now };
      return isin;
    }
  } catch {}

  // Search fallback: ISIN → Yahoo Finance symbol
  const { data: search } = await axios.get(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=1&newsCount=0`,
    { timeout: 8000, headers: YF_HEADERS }
  );
  const symbol = search?.quotes?.[0]?.symbol;
  if (!symbol) throw new Error(`ISIN ${isin} introuvable sur Yahoo Finance`);

  isinCache[isin] = { ticker: symbol, ts: now };
  return symbol;
}

async function resolvePrice(ticker) {
  const now = Date.now();
  if (cache[ticker] && now - cache[ticker].ts < CACHE_TTL) return cache[ticker];

  const result = CRYPTO_MAP[ticker] ? await fetchCrypto(ticker) : await fetchStock(ticker);
  const entry = { ...result, ticker, ts: now };
  if (result.price != null) cache[ticker] = entry;
  return entry;
}

// Resolves either a ticker (BTC, AAPL) or an ISIN (IE00B4L5Y983)
// Result is cached under the original key so the frontend can look up by ISIN
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

  return resolvePrice(key);
}

module.exports = { resolvePrice, resolvePriceByKey };
