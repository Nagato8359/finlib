const { Redis } = require('@upstash/redis');
const { supabaseAdmin } = require('./_supabase');
const { yfGetWithFallback, CRYPTO_MAP, isinToTicker } = require('./_priceUtils');
const { getCached, setCached, delCached } = require('./_cache');
const { sendPushToUser } = require('./_push');

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

function detectDivFrequency(sortedDates) {
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

const DIV_FREQ_DAYS = { mensuel: 30, trimestriel: 91, semestriel: 183, annuel: 365 };

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

  // ── action=clear-cache : purge all realt:* keys from Redis ──────────────────
  if (req.query.action === 'clear-cache') {
    if (!process.env.CRON_SECRET || req.query.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return res.status(500).json({ error: 'Redis not configured' });
    }
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    try {
      const found = [];
      let cursor = 0;
      do {
        const [next, keys] = await redis.scan(cursor, { match: 'realt:*', count: 100 });
        cursor = parseInt(next, 10);
        found.push(...keys);
      } while (cursor !== 0);
      const extra = ['realt:csv:v1', 'realt:v3:tokenlist', 'realt:tokenlist:xdai:v2'];
      const toDelete = [...new Set([...found, ...extra])];
      const deleted = toDelete.length > 0 ? await redis.del(...toDelete) : 0;
      console.log(`[cron-prices] clear-cache: deleted ${deleted} realt: keys`);
      return res.json({ ok: true, deleted, keys: toDelete });
    } catch (err) {
      console.error('[cron-prices] clear-cache error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Vercel injects CRON_SECRET automatically for scheduled invocations
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Read all user data (requires service role key)
    const { data: rows, error: dbErr } = await supabaseAdmin
      .from('user_data')
      .select('user_id, investments, savings, health_assets, loans, updated_at, preferences');
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
    let settled = [];
    if (keys.length) {
      settled = await Promise.allSettled(
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
            return { key, ok: !upsErr, change_pct: entry.change_pct, price: entry.price };
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

    // 7. Invalidate stale RealT rent caches (last cached rent older than 7 days)
    let rentsInvalidated = 0;
    for (const wallet of realtWallets) {
      try {
        const cacheKey = `realt:rents:${wallet}`;
        const cached = await getCached(cacheKey);
        if (!cached || !cached.allRents?.length) continue;
        const lastRentDate = cached.allRents[0]?.date;
        if (!lastRentDate) continue;
        const daysSince = (Date.now() - new Date(lastRentDate).getTime()) / 86400000;
        if (daysSince > 7) {
          await delCached(cacheKey);
          rentsInvalidated++;
          console.log(`[cron-prices] RealT rents: invalidated cache for ${wallet} (last rent ${Math.round(daysSince)}d ago)`);
        }
      } catch (e) {
        console.error(`[cron-prices] RealT rent cache check ${wallet}:`, e.message);
      }
    }
    if (realtWallets.size) console.log(`[cron-prices] RealT rents: ${rentsInvalidated}/${realtWallets.size} cache(s) invalidated`);

    // 8. Fetch and upsert dividend events for stock/ETF tickers
    const divTickerSet = new Set();
    for (const row of rows || []) {
      for (const inv of row.investments || []) {
        for (const pos of inv.positions || []) {
          if (['stock', 'etf'].includes(pos.posType) && pos.ticker && !ISIN_RE.test(pos.ticker.toUpperCase())) {
            divTickerSet.add(pos.ticker.split('.')[0].toUpperCase());
          }
        }
      }
    }
    const divTickers = [...divTickerSet];
    let divUpserted = 0;
    if (divTickers.length) {
      await Promise.allSettled(divTickers.map(async ticker => {
        try {
          const data = await yfGetWithFallback(
            `/v8/finance/chart/${encodeURIComponent(ticker)}?events=dividends&range=3y&interval=1mo`
          );
          const result = data?.chart?.result?.[0];
          if (!result) return;

          const currency = result.meta?.currency || 'USD';
          const toEUR = currency === 'EUR' ? 1 : 1 / eurusd;
          const divEvents = result.events?.dividends || {};
          const sorted = Object.values(divEvents).sort((a, b) => a.date - b.date);
          if (!sorted.length) return;

          const confirmed = sorted.map(e => ({
            ticker,
            ex_date:    new Date(e.date * 1000).toISOString().slice(0, 10),
            amount:     Math.round(e.amount * 1e6) / 1e6,
            currency,
            amount_eur: Math.round(e.amount * toEUR * 1e6) / 1e6,
            status:     'confirmed',
            source:     'yahoo',
            updated_at: new Date().toISOString(),
          }));

          const { error: confErr } = await supabaseAdmin
            .from('dividend_events')
            .upsert(confirmed, { onConflict: 'ticker,ex_date' });
          if (confErr) { console.error(`[cron] div upsert ${ticker}:`, confErr.message); return; }
          divUpserted += confirmed.length;

          // Project up to 4 estimated future dividends (don't overwrite confirmed)
          const frequency = detectDivFrequency(sorted.map(e => new Date(e.date * 1000)));
          const gapMs = DIV_FREQ_DAYS[frequency] * 86400000;
          const last = confirmed[confirmed.length - 1];
          let baseMs = new Date(last.ex_date).getTime();
          const estimated = [];
          for (let i = 0; i < 4; i++) {
            baseMs += gapMs;
            if (baseMs <= Date.now()) continue;
            estimated.push({
              ticker,
              ex_date:    new Date(baseMs).toISOString().slice(0, 10),
              amount:     last.amount,
              currency,
              amount_eur: last.amount_eur,
              status:     'estimated',
              source:     'estimated',
              updated_at: new Date().toISOString(),
            });
          }
          if (estimated.length) {
            await supabaseAdmin
              .from('dividend_events')
              .upsert(estimated, { onConflict: 'ticker,ex_date', ignoreDuplicates: true });
          }
        } catch (e) {
          console.error(`[cron] dividends ${ticker}:`, e.message);
        }
      }));
      console.log(`[cron-prices] dividends: ${divUpserted} confirmed events upserted for ${divTickers.length} tickers`);
    }

    // 9. Push notifications — inactivité, dividendes J+3, paliers, records, performance
    const todayNotifStr = new Date().toISOString().slice(0, 10);
    let pushSent = 0;

    // Build ticker-stats map from step-4 settled results (performance alerts)
    const tickerStats = {};
    for (const r of (settled || [])) {
      if (r.status === 'fulfilled' && r.value?.ok && r.value.change_pct != null) {
        tickerStats[r.value.key] = { change_pct: r.value.change_pct, price: r.value.price };
      }
    }

    // Build per-user stock holdings map: userId → { base_ticker → shares }
    const userHoldings = {};
    for (const row of rows || []) {
      if (!row.user_id) continue;
      userHoldings[row.user_id] = {};
      for (const inv of row.investments || []) {
        for (const pos of inv.positions || []) {
          if (['stock', 'etf'].includes(pos.posType) && pos.ticker) {
            const base = pos.ticker.split('.')[0].toUpperCase();
            userHoldings[row.user_id][base] = (userHoldings[row.user_id][base] || 0) + (parseFloat(pos.shares) || 0);
          }
        }
      }
    }

    // A) Per-user notifications (inactivité, paliers, records)
    for (const row of rows || []) {
      if (!row.user_id) continue;
      const np = row.preferences?.notifications ?? {};

      // A1. Inactivité
      if (np.inactivite !== false && row.updated_at) {
        const daysSince = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86400000);
        const inactMsgs = {
          3:  'Cela fait 3 jours que vous n\'avez pas mis à jour votre patrimoine. Un petit coup d\'œil ?',
          7:  '1 semaine sans mise à jour ! Vos données sont peut-être obsolètes. 2 minutes suffisent.',
          14: '2 semaines sans activité. Votre patrimoine affiché ne reflète peut-être plus la réalité.',
          30: '1 mois sans mise à jour ! Vos données sont probablement obsolètes.',
          60: 'Vous nous manquez ! Votre dernier suivi date de 2 mois.',
          90: '3 mois d\'absence... Votre patrimoine a peut-être bien évolué depuis. Revenez voir !',
        };
        const inactMsg = inactMsgs[daysSince];
        if (inactMsg) {
          const cKey = `push:inact:${row.user_id}:${daysSince}`;
          if (!await getCached(cKey)) {
            await sendPushToUser(row.user_id, '📝 Capitaly — Rappel', inactMsg, '/');
            await setCached(cKey, '1', 2 * 86400);
            pushSent++;
          }
        }
      }

      // A2. Paliers patrimoine
      const userHist = historyEntries.find(e => e.user_id === row.user_id);
      const currentPat = userHist?.valeur || 0;
      if (currentPat > 0 && np.paliers !== false) {
        const MILESTONES = [50000, 100000, 150000, 200000, 500000, 1000000];
        for (const ms of MILESTONES) {
          if (currentPat >= ms) {
            const mKey = `push:mile:${row.user_id}:${ms}`;
            if (!await getCached(mKey)) {
              const fmt = new Intl.NumberFormat('fr-FR').format(ms);
              await sendPushToUser(row.user_id, '🏆 Palier franchi !', `Votre patrimoine dépasse les ${fmt}€. Félicitations !`, '/');
              await setCached(mKey, '1', 365 * 86400);
              pushSent++;
              break;
            }
          }
        }

        // A3. Record patrimoine (once per day)
        const recKey = `push:rec:${row.user_id}`;
        const recDayKey = `push:recday:${row.user_id}:${todayNotifStr}`;
        const prevMaxStr = await getCached(recKey);
        const prevMax = parseFloat(prevMaxStr || '0');
        if (currentPat > prevMax) {
          await setCached(recKey, String(currentPat), 400 * 86400);
          if (prevMax > 0 && currentPat > prevMax * 1.005 && !await getCached(recDayKey)) {
            const fmt = new Intl.NumberFormat('fr-FR').format(currentPat);
            await sendPushToUser(row.user_id, '📈 Record battu !', `Votre patrimoine atteint un nouveau sommet : ${fmt}€ 🎉`, '/');
            await setCached(recDayKey, '1', 86400);
            pushSent++;
          }
        }
      }
    }

    // B) Dividende dans 3 jours
    const in3days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const { data: upcomingDivs } = await supabaseAdmin
      .from('dividend_events')
      .select('ticker, amount, amount_eur, currency')
      .eq('ex_date', in3days)
      .eq('status', 'confirmed');

    for (const ev of upcomingDivs || []) {
      const divKey = `push:div3:${ev.ticker}:${in3days}`;
      if (await getCached(divKey)) continue;
      for (const row of rows || []) {
        if (!row.user_id || (row.preferences?.notifications?.dividendes) === false) continue;
        if (!userHoldings[row.user_id]?.[ev.ticker]) continue;
        const amtStr = ev.amount_eur ? `${ev.amount_eur.toFixed(4)}€` : `${ev.amount} ${ev.currency}`;
        await sendPushToUser(row.user_id, '💰 Dividende imminent', `${ev.ticker} verse ${amtStr}/action dans 3 jours.`, '/');
        pushSent++;
      }
      await setCached(divKey, '1', 4 * 86400);
    }

    // C) Performance actifs (+/- 5%)
    for (const [ticker, stats] of Object.entries(tickerStats)) {
      if (Math.abs(stats.change_pct) < 5) continue;
      const perfKey = `push:perf:${ticker}:${todayNotifStr}`;
      if (await getCached(perfKey)) continue;
      const isDown = stats.change_pct < 0;
      const pct = Math.abs(stats.change_pct).toFixed(1);
      for (const row of rows || []) {
        if (!row.user_id || (row.preferences?.notifications?.performance) === false) continue;
        const shares = userHoldings[row.user_id]?.[ticker];
        if (!shares) continue;
        const impact = Math.round(shares * (stats.price || 0) * Math.abs(stats.change_pct) / 100);
        const impactStr = impact > 0 ? ` ${isDown ? 'Impact' : 'Gain'} : ${isDown ? '-' : '+'}${new Intl.NumberFormat('fr-FR').format(impact)}€` : '';
        const body = `${ticker} ${isDown ? `a chuté de ${pct}%` : `+${pct}%`} aujourd'hui.${impactStr}`;
        await sendPushToUser(row.user_id, `${isDown ? '📉' : '📈'} ${ticker}`, body, '/');
        pushSent++;
      }
      await setCached(perfKey, '1', 86400);
    }

    console.log(`[cron-prices] push: ${pushSent} notifications envoyées`);

    res.json({ ok: true, updated, realtUpdated, total: keys.length, snapshots: historyEntries.length, rentsInvalidated, divTickers: divTickers.length, divUpserted, pushSent });
  } catch (err) {
    console.error('[cron-prices] fatal:', err.message);
    res.status(500).json({ error: err.message });
  }
};
