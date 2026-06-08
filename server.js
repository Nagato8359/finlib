process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Crypto ticker → CoinGecko coin ID
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
const CACHE_TTL = 30_000;
const EURUSD_TTL = 300_000;
const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

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
  const price = result?.meta?.regularMarketPrice;
  const currency = result?.meta?.currency || 'USD';

  let priceEur = price;
  if (currency === 'USD' && price) {
    const eurusd = await getEURUSD();
    priceEur = price / eurusd;
  }

  return { price: priceEur, source: 'Yahoo Finance' };
}

async function resolvePrice(ticker) {
  const now = Date.now();
  if (cache[ticker] && now - cache[ticker].ts < CACHE_TTL) return cache[ticker];

  const result = CRYPTO_MAP[ticker] ? await fetchCrypto(ticker) : await fetchStock(ticker);
  const entry = { ...result, ticker, ts: now };
  if (result.price != null) cache[ticker] = entry;
  return entry;
}

// Single ticker
app.get('/api/price/:ticker', async (req, res) => {
  try {
    const data = await resolvePrice(req.params.ticker.toUpperCase());
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, ticker: req.params.ticker.toUpperCase() });
  }
});

// Batch tickers
app.get('/api/prices', async (req, res) => {
  const tickers = String(req.query.tickers || '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  const out = {};
  await Promise.allSettled(tickers.map(async ticker => {
    try {
      const data = await resolvePrice(ticker);
      if (data.price != null) out[ticker] = data.price;
    } catch {}
  }));
  res.json(out);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓  FinLib prix en direct → http://localhost:${PORT}`);
  console.log(`   /api/price/:ticker  — prix unique`);
  console.log(`   /api/prices?tickers=BTC,ETH,CW8  — lot\n`);
});
