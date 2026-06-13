const { supabaseAdmin } = require('./_supabase');
const { yfGetWithFallback, CRYPTO_MAP, isinToTicker } = require('./_priceUtils');

const COMMODITY_TICKER_MAP = {
  'Or': 'GC=F', 'Argent': 'SI=F', 'Platine': 'PL=F',
  'Palladium': 'PA=F', 'Pétrole': 'CL=F', 'Cuivre': 'HG=F',
};
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/;

const UNSUPPORTED_TICKERS = [
  'REALT', 'REALT.',                    // RealT tokens
  'SCPI', 'OPCI', 'SCI',               // Pierre-papier
  'GFI', 'GFV',                         // Forêts / Vignes
  'PER',                                 // Plan Épargne Retraite
];

async function getEURUSD() {
  try {
    const d = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

async function fetchStockEntry(ticker, eurusd) {
  const data = await yfGetWithFallback(
    `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
  );
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo result for ${ticker}`);

  const { regularMarketPrice: rawPrice, currency = 'USD', chartPreviousClose, previousClose } = result.meta;
  const prevClose = chartPreviousClose ?? previousClose;
  const price = currency === 'USD' ? rawPrice / eurusd : rawPrice;
  const change_pct = prevClose && prevClose !== 0 ? ((rawPrice - prevClose) / prevClose) * 100 : null;
  return { price, change_pct };
}

async function fetchCryptoEntry(coinId) {
  const [priceRes, chartRes] = await Promise.allSettled([
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`,
      { signal: AbortSignal.timeout(8000) }
    ),
    fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=1`,
      { signal: AbortSignal.timeout(8000) }
    ),
  ]);

  let price = null;
  let change_pct = null;

  if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
    const d = await priceRes.value.json();
    price = d[coinId]?.eur ?? null;
  }
  if (chartRes.status === 'fulfilled' && chartRes.value.ok) {
    const d = await chartRes.value.json();
    const pts = d.prices;
    if (pts?.length >= 2) {
      change_pct = ((pts[pts.length - 1][1] - pts[0][1]) / pts[0][1]) * 100;
    }
  }
  return { price, change_pct };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Vercel injects CRON_SECRET automatically for scheduled invocations
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Read all user data (requires service role key)
    const { data: rows, error: dbErr } = await supabaseAdmin
      .from('user_data')
      .select('user_id, investments, savings, health_assets, loans');
    if (dbErr) throw new Error(`user_data read: ${dbErr.message}`);

    // 2. Extract unique tickers and RealT wallet addresses
    const tickerSet = new Set();
    const realtWallets = new Set();
    for (const row of rows || []) {
      for (const inv of row.investments || []) {
        // Collect RealT wallet addresses for community API update
        if (inv.type === 'RealT' && inv.platform && /^0x[0-9a-fA-F]{40}$/i.test(inv.platform)) {
          realtWallets.add(inv.platform.toLowerCase());
        }
        for (const pos of inv.positions || []) {
          // Skip manual-priced position types (no Yahoo Finance ticker to fetch)
          if (pos.posType === 'other' || pos.posType === 'realestate') continue;
          if (pos.posType === 'commodity') {
            const t = COMMODITY_TICKER_MAP[pos.commodityType];
            if (t) tickerSet.add(t);
          } else if (pos.isin) {
            tickerSet.add(pos.isin);
          } else if (pos.ticker) {
            tickerSet.add(pos.ticker);
          }
        }
      }
    }

    const keys = [...tickerSet].filter(k => !UNSUPPORTED_TICKERS.includes(k.toUpperCase()));
    if (!keys.length && !realtWallets.size) return res.json({ ok: true, updated: 0, realtUpdated: 0, total: 0 });

    // 3. Fetch EUR/USD once for all USD-denominated assets
    const eurusd = await getEURUSD();

    // 4. Fetch price + 1d change_pct for Yahoo Finance / CoinGecko tickers
    let updated = 0;
    if (keys.length) {
      const settled = await Promise.allSettled(
        keys.map(async (key) => {
          try {
            const upper = key.toUpperCase();
            let entry;
            if (CRYPTO_MAP[upper]) {
              entry = await fetchCryptoEntry(CRYPTO_MAP[upper]);
            } else {
              const ticker = ISIN_RE.test(upper) ? await isinToTicker(upper) : upper;
              entry = await fetchStockEntry(ticker, eurusd);
            }

            if (entry.price == null) return { key, ok: false };

            const { error: upsErr } = await supabaseAdmin.from('prices_cache').upsert({
              ticker: key,
              price:      parseFloat(entry.price.toFixed(4)),
              change_pct: entry.change_pct != null ? parseFloat(entry.change_pct.toFixed(3)) : null,
              currency:   'EUR',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'ticker' });

            if (upsErr) console.error(`[cron] upsert ${key}:`, upsErr.message);
            return { key, ok: !upsErr };
          } catch (e) {
            console.error(`[cron] ${key}:`, e.message);
            return { key, ok: false };
          }
        })
      );
      updated = settled.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
      console.log(`[cron-prices] ${updated}/${keys.length} tickers refreshed`);
    }

    // 5. Fetch RealT token prices from community API and upsert to prices_cache
    let realtUpdated = 0;
    for (const wallet of realtWallets) {
      try {
        const rtRes = await fetch(`https://api.realtoken.community/v1/holder/${wallet}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!rtRes.ok) { console.error(`[cron] RealT ${wallet}: HTTP ${rtRes.status}`); continue; }
        const raw = await rtRes.json();
        const balances = Array.isArray(raw) ? raw : raw?.holder?.balances || raw?.balances || [];

        for (const b of balances) {
          const token = b.token || {};
          const amount = parseFloat(b.amount) || 0;
          if (amount <= 0) continue;
          const ticker = (token.shortName || token.symbol || '').toUpperCase();
          const priceUSD = parseFloat(token.tokenPrice) || 0;
          if (!ticker || priceUSD <= 0) continue;

          const priceEUR = priceUSD / eurusd;
          const { error: upsErr } = await supabaseAdmin.from('prices_cache').upsert({
            ticker,
            price:      parseFloat(priceEUR.toFixed(4)),
            change_pct: null,
            currency:   'EUR',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'ticker' });

          if (!upsErr) realtUpdated++;
          else console.error(`[cron] RealT ${ticker}:`, upsErr.message);
        }
      } catch (e) {
        console.error(`[cron] RealT wallet ${wallet}:`, e.message);
      }
    }
    if (realtWallets.size) console.log(`[cron-prices] RealT: ${realtUpdated} token prices updated`);

    // 6. Record one patrimoine snapshot per user per hour
    const snapshotHour = new Date();
    snapshotHour.setMinutes(0, 0, 0);
    const recordedAt = snapshotHour.toISOString();

    const historyEntries = (rows || [])
      .filter(row => row.user_id)
      .map(row => {
        const investments_ = row.investments || [];
        const savings_     = row.savings || [];
        const healthAssets = row.health_assets || [];
        const loans_       = row.loans || [];
        const invTotal_    = investments_.reduce((s, inv) => s + (parseFloat(inv.value) || 0), 0);
        const cashTotal_   = savings_.reduce((s, c) => s + (parseFloat(c.balance) || 0), 0);
        const healthTotal_ = healthAssets.reduce((s, h) => s + (parseFloat(h.currentValue) || 0), 0);
        const linkedDebt   = investments_
          .filter(inv => inv.loanId)
          .reduce((s, inv) => {
            const loan = loans_.find(l => l.id === inv.loanId);
            return s + (parseFloat(loan?.capitalRemaining) || 0);
          }, 0);
        const valeur = Math.round(invTotal_ + cashTotal_ + healthTotal_ - linkedDebt);
        return { user_id: row.user_id, valeur, recorded_at: recordedAt };
      })
      .filter(e => e.valeur > 0);

    if (historyEntries.length > 0) {
      const { error: histErr } = await supabaseAdmin
        .from('patrimoine_history')
        .upsert(historyEntries, { onConflict: 'user_id,recorded_at' });
      if (histErr) console.error('[cron-prices] patrimoine_history:', histErr.message);
      else console.log(`[cron-prices] patrimoine_history: ${historyEntries.length} snapshots`);
    }

    res.json({ ok: true, updated, realtUpdated, total: keys.length, snapshots: historyEntries.length });
  } catch (err) {
    console.error('[cron-prices] fatal:', err.message);
    res.status(500).json({ error: err.message });
  }
};
