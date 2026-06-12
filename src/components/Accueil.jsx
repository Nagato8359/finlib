import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { TT, makeS, fEur, fPct, fDate, MONTHS, CAT_COLORS } from '../utils/constants';
import { useTranslation } from '../hooks/useTranslation';
import { computeTrophies } from '../utils/trophies';
import Confetti from './Confetti';

const TF_DAYS = { '1J': 1, '7J': 7, '1M': 30, '3M': 90, '1AN': 365 };
const PERF_TF_DAYS = { '1J': 1, '1S': 7, '1M': 30, '3M': 90, '1AN': 365, 'TOUT': null };

const TYPE_ICON = {
  'PEA': '📈', 'CTO': '📊', 'Assurance Vie': '🛡️', 'AV': '🛡️',
  'PER': '🏦', 'Immobilier': '🏠', 'Crypto': '₿', 'SCPI': '🏢',
};

// Deterministic sparkline based on pnl + a seed value (asset name)
function genSparkline(pnlPct, seed = 0) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const progress = i / (n - 1);
    const noise = Math.sin(i * 1.7 + seed * 0.3) * Math.abs(pnlPct) * 0.18;
    pts.push({ v: progress * pnlPct + noise });
  }
  pts[n - 1] = { v: pnlPct };
  return pts;
}

function MiniSparkline({ pnlPct, seed }) {
  const color = pnlPct >= 0 ? 'var(--color-accent)' : '#f87171';
  const data = useMemo(() => genSparkline(pnlPct, seed), [pnlPct, seed]);
  return (
    <LineChart width={72} height={34} data={data} style={{ flexShrink: 0 }}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

function AssetCard({ T, name, type, value, pnlPct, seed, onClick }) {
  const color = pnlPct >= 0 ? T.accent : '#f87171';
  const icon = TYPE_ICON[type] || '💼';
  return (
    <div
      onClick={onClick}
      style={{
        background: T.bg3 || T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 16, padding: '16px 16px',
        minWidth: 180, maxWidth: 200,
        display: 'flex', flexDirection: 'column', gap: 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, transform .15s',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color,
          background: pnlPct >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)',
          padding: '2px 7px', borderRadius: 20,
        }}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
        </span>
      </div>
      <div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {type}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{fEur(value, true)}</span>
        <MiniSparkline pnlPct={pnlPct} seed={seed} />
      </div>
    </div>
  );
}

export default function Accueil({ T, data, setTab }) {
  const S = makeS(T);
  const { t } = useTranslation();
  const [chartTf, setChartTf]   = useState('1M');
  const [perfTf, setPerfTf]     = useState('1M');
  const [showConfetti, setShowConfetti] = useState(false);
  const [openPerf, setOpenPerf]   = useState(null); // 'inv'|'revenus'|'depenses'|'ventes'|'epargne'
  const [openInvId, setOpenInvId] = useState(null); // envelope sub-accordion
  const [openCat, setOpenCat]     = useState(null); // dépenses category sub-accordion
  const perfPricesCache = useRef({}); // { 'KEY__TF': { changePct, loading, error } }
  const [perfPrices, setPerfPrices] = useState({});
  const [intradayHistory, setIntradayHistory] = useState([]);
  const [intradayLoading, setIntradayLoading] = useState(false);

  const {
    transactions, patrimoine, patrimoineNet, linkedLoanDebt,
    invTotal, invInvested, cashTotal, healthTotal,
    income, balance, savingsRate, score,
    goals, healthCost,
    investments, invLiveValue, invLiveInvested,
    soldHistory,
  } = data;

  // ── Performance prices — fetch period % via /api/performance ────────────
  useEffect(() => {
    if (perfTf === 'TOUT') return;
    const seen = new Set();
    const toFetch = [];
    (investments || []).forEach(inv => {
      const isCrypto = /crypto/i.test(inv.type || '');
      (inv.positions || []).forEach(p => {
        const key = (p.isin || p.ticker || '').toUpperCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        const cacheKey = `${key}__${perfTf}`;
        if (cacheKey in perfPricesCache.current) return;
        perfPricesCache.current[cacheKey] = { loading: true };
        toFetch.push({ key, cacheKey, isCrypto });
      });
    });
    if (toFetch.length === 0) return;
    // Trigger re-render to show loading state
    setPerfPrices({ ...perfPricesCache.current });

    Promise.allSettled(
      toFetch.map(({ key, cacheKey }) =>
        fetch(`/api/performance?key=${encodeURIComponent(key)}&tf=${perfTf}`)
          .then(r => r.json())
          .then(data => {
            perfPricesCache.current[cacheKey] = data.error
              ? { error: data.error }
              : { changePct: data.changePct };
          })
          .catch(err => {
            perfPricesCache.current[cacheKey] = { error: err.message };
          })
      )
    ).then(() => setPerfPrices({ ...perfPricesCache.current }));
  }, [perfTf, investments]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Intraday 1J — fetch temps réel via YF/CoinGecko ─────────────────────
  useEffect(() => {
    if (chartTf !== '1J') return;

    const positions = [];
    (investments || []).forEach(inv => {
      (inv.positions || []).forEach(p => {
        const key = (p.isin || p.ticker || '').toUpperCase();
        if (key && (p.shares || 0) > 0) positions.push({ key, shares: p.shares });
      });
    });
    const baseValue = (cashTotal || 0) + (healthTotal || 0);

    setIntradayLoading(true);
    const ctrl = new AbortController();

    fetch('/api/intraday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions, baseValue }),
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(result => { setIntradayHistory(result.points || []); setIntradayLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') setIntradayLoading(false); });

    return () => ctrl.abort();
  }, [chartTf, investments, cashTotal, healthTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Patrimoine history ───────────────────────────────────────────────────
  const patrimoineHistory = useMemo(() => {
    const days = TF_DAYS[chartTf] || 30;
    const step = days <= 7 ? 1 : days <= 30 ? 2 : days <= 90 ? 7 : 30;
    const now = new Date();
    const points = [];
    const seen = new Set();
    const baseNet = patrimoineNet ?? patrimoine;
    for (let i = days; i >= 0; i -= step) {
      const date = new Date(now.getTime() - i * 86400000);
      const futureTx = transactions.filter(tx => new Date(tx.date) > date && new Date(tx.date) <= now);
      const cashDiff = futureTx.reduce((s, tx) => s + tx.amount, 0);
      const val = Math.max(0, baseNet - cashDiff);
      const label = days <= 7
        ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
        : days <= 30
        ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : MONTHS[date.getMonth()] + (days > 90 ? ` ${date.getFullYear().toString().slice(2)}` : '');
      if (!seen.has(label)) { seen.add(label); points.push({ label, Patrimoine: val }); }
    }
    points.push({ label: t('today_label'), Patrimoine: Math.round(baseNet) });
    return points;
  }, [chartTf, transactions, patrimoine, patrimoineNet, t]);

  const displayPatrimoine = patrimoineNet ?? patrimoine;
  const histOpen = chartTf === '1J' && intradayHistory.length > 0
    ? intradayHistory[0].Patrimoine
    : (patrimoineHistory.length > 1 ? patrimoineHistory[0].Patrimoine : displayPatrimoine);
  const change = displayPatrimoine - histOpen;
  const changePct = histOpen > 0 && histOpen !== displayPatrimoine ? (change / histOpen) * 100 : 0;
  const scoreColor = score >= 70 ? '#4ade80' : score >= 40 ? '#fb923c' : '#f87171';

  // ── Allocation donut ─────────────────────────────────────────────────────
  const allocData = useMemo(() => [
    { name: t('accueil_investissements'), value: invTotal, color: T.accent },
    { name: t('accueil_epargne_cash'), value: cashTotal, color: '#34d399' },
    { name: t('accueil_materiel'), value: healthTotal, color: '#60a5fa' },
  ].filter(d => d.value > 0), [invTotal, cashTotal, healthTotal, t]);

  // ── Performance globale ──────────────────────────────────────────────────
  const perfData = useMemo(() => {
    // PV latente investissements — toujours le total actuel (pas d'historique des prix)
    let invPV = 0;
    (investments || []).forEach(inv => {
      const val = invLiveValue ? invLiveValue(inv) : (parseFloat(inv.value) || 0);
      const invested = invLiveInvested ? invLiveInvested(inv) : (parseFloat(inv.invested) || 0);
      invPV += val - invested;
    });
    const invInvestedTotal = parseFloat(invInvested) || 0;
    const invPVPct = invInvestedTotal > 0 ? (invPV / invInvestedTotal) * 100 : 0;

    // Filtre par timeframe
    const days = PERF_TF_DAYS[perfTf];
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    const inPeriod = dateStr => !cutoff || new Date(dateStr) >= cutoff;

    // Revenus et dépenses filtrés
    let revenues = 0;
    let depenses = 0;
    (transactions || []).forEach(tx => {
      if (!inPeriod(tx.date)) return;
      if (tx.amount > 0) revenues += tx.amount;
      else depenses += tx.amount; // déjà négatif
    });

    // Ventes réalisées filtrées
    let ventes = 0;
    (soldHistory || []).forEach(item => {
      if (!inPeriod(item.soldDate)) return;
      ventes += parseFloat(item.profit) || 0;
    });

    const epargneNette = revenues + depenses; // depenses déjà négatif
    const totalPeriod = revenues + depenses + ventes;

    // Variation intraday pour 1J (depuis perfPrices qui fetche /api/performance?tf=1J)
    let invDailyPnl = null;
    if (perfTf === '1J') {
      invDailyPnl = 0;
      (investments || []).forEach(inv => {
        (inv.positions || []).forEach(p => {
          const key = (p.isin || p.ticker || '').toUpperCase();
          if (!key) return;
          const livePrice = (data.prices?.[key]) || p.currentPrice || 0;
          const posVal = (p.shares || 0) * livePrice;
          const entry = perfPrices[`${key}__1J`];
          if (entry?.changePct != null) invDailyPnl += posVal * entry.changePct / 100;
        });
      });
    }

    const total = perfTf === 'TOUT'
      ? invPV + totalPeriod
      : perfTf === '1J'
        ? (invDailyPnl !== null ? invDailyPnl : 0) + totalPeriod
        : totalPeriod;

    return { total, totalPeriod, invPV, invPVPct, invInvestedTotal, revenues, depenses, ventes, epargneNette, invDailyPnl };
  }, [perfTf, investments, invLiveValue, invLiveInvested, invInvested, transactions, soldHistory, perfPrices]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detail data for performance accordions ──────────────────────────────
  const perfDetail = useMemo(() => {
    const days = PERF_TF_DAYS[perfTf];
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    const inP = d => !cutoff || new Date(d) >= cutoff;
    const revenusRows = (transactions || [])
      .filter(tx => tx.amount > 0 && inP(tx.date))
      .sort((a, b) => b.date.localeCompare(a.date));
    const depensesRows = (transactions || [])
      .filter(tx => tx.amount < 0 && inP(tx.date));
    const ventesRows = (soldHistory || [])
      .filter(i => inP(i.soldDate))
      .sort((a, b) => (b.soldDate || '').localeCompare(a.soldDate || ''));
    const depByCat = {};
    depensesRows.forEach(tx => {
      if (!depByCat[tx.category]) depByCat[tx.category] = [];
      depByCat[tx.category].push(tx);
    });
    const depGroups = Object.entries(depByCat)
      .map(([cat, txs]) => ({ cat, txs, total: txs.reduce((s, t) => s + Math.abs(t.amount), 0) }))
      .sort((a, b) => b.total - a.total);
    return { revenusRows, depGroups, ventesRows };
  }, [perfTf, transactions, soldHistory]);

  // ── Trophées ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trophyResult = useMemo(() => computeTrophies(data), [
    data.patrimoine, data.investments, data.invTotal, data.income, data.savingsRate,
    data.transactions, data.budgets, data.goals, data.soldHistory,
    data.score, data.user,
  ]);

  useEffect(() => {
    const saved = new Set(JSON.parse(localStorage.getItem('capitaly_achievements') || '[]'));
    const currentlyUnlocked = trophyResult.trophies.filter(t => t.unlocked).map(t => t.id);

    // Fire confetti only for IDs not yet in the persistent set
    const newOnes = currentlyUnlocked.filter(id => !saved.has(id));
    if (newOnes.length > 0) {
      setShowConfetti(true);
      // Accumulate — the set never shrinks so already-celebrated trophies never re-trigger
      localStorage.setItem('capitaly_achievements', JSON.stringify([...saved, ...newOnes]));
    }
  }, [trophyResult]);

  const handleConfettiDone = useCallback(() => setShowConfetti(false), []);

  const intradayTooltip = useCallback(({ active, payload, label }) => {
    if (!active || !payload?.[0]) return null;
    const val = payload[0].value;
    const openVal = payload[0].payload?.open || 0;
    const diff = val - openVal;
    const pct = openVal > 0 ? (diff / openVal) * 100 : 0;
    const col = diff >= 0 ? '#4ade80' : '#f87171';
    return (
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
        <div style={{ color: T.textMuted, marginBottom: 5, fontWeight: 600, fontSize: 11 }}>{label}</div>
        <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{fEur(val)}</div>
        <div style={{ color: col, fontWeight: 600, marginTop: 3 }}>
          {diff >= 0 ? '+' : ''}{fEur(diff, true)} ({diff >= 0 ? '+' : ''}{pct.toFixed(2)}%)
        </div>
        <div style={{ color: T.textFaint, fontSize: 10, marginTop: 4 }}>depuis l'ouverture</div>
      </div>
    );
  }, [T]);

  // ── Asset cards ──────────────────────────────────────────────────────────
  const assetCards = useMemo(() => {
    const cards = [];
    (investments || []).forEach((inv, i) => {
      const val = invLiveValue ? invLiveValue(inv) : (parseFloat(inv.value) || 0);
      const invested = invLiveInvested ? invLiveInvested(inv) : (parseFloat(inv.invested) || 0);
      const pnlPct = invested > 0 ? ((val - invested) / invested) * 100 : 0;
      cards.push({ id: inv.id, name: inv.name, type: inv.type || inv.category || '—', value: val, pnlPct, seed: i });
    });
    if (cashTotal > 0) cards.push({ id: '__cash', name: t('accueil_epargne_cash'), type: 'Épargne', value: cashTotal, pnlPct: 0, seed: 99 });
    if (healthTotal > 0) cards.push({ id: '__health', name: t('accueil_materiel'), type: 'Matériel', value: healthTotal, pnlPct: (healthTotal - healthCost) / Math.max(1, healthCost) * 100, seed: 100 });
    return cards;
  }, [investments, invLiveValue, invLiveInvested, cashTotal, healthTotal, healthCost, t]);

  const card = { ...S.card };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>


      {/* ── Top 2-col grid ─────────────────────────────────────────────── */}
      <div className="accueil-top-grid" style={{ display: 'grid', gridTemplateColumns: '65fr 35fr', gap: 20, alignItems: 'start', width: '100%' }}>

        {/* LEFT — patrimoine + chart */}
        <div style={{ ...card }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                {t('accueil_patrimoine_total')}
                {linkedLoanDebt > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: T.textFaint }}>{t('accueil_net_value')}</span>}
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-.04em', color: T.text, lineHeight: 1.1 }}>
                {fEur(displayPatrimoine)}
              </div>
              {linkedLoanDebt > 0 && (
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                  {t('accueil_gross')} : {fEur(patrimoine)} · {t('accueil_immo_debt')} : <span style={{ color: '#f87171' }}>−{fEur(linkedLoanDebt)}</span>
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: change >= 0 ? '#4ade80' : '#f87171', background: change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)', padding: '3px 10px', borderRadius: 20 }}>
                  {change >= 0 ? '+' : ''}{fEur(change, true)} ({fPct(changePct)})
                </span>
                <span style={{ fontSize: 12, color: T.textMuted }}>{t('over')} {chartTf}</span>
              </div>
            </div>

            {/* Timeframe buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {Object.keys(TF_DAYS).map(tf => (
                <button key={tf} onClick={() => setChartTf(tf)} style={{
                  background: chartTf === tf ? T.accent + '26' : 'transparent',
                  border: `1px solid ${chartTf === tf ? T.accent : T.cardBorder}`,
                  color: chartTf === tf ? T.accent : T.textMuted,
                  borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                }}>
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {chartTf === '1J' && intradayLoading && intradayHistory.length === 0 && (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 12 }}>
              Chargement des données temps réel…
            </div>
          )}
          {!(chartTf === '1J' && intradayLoading && intradayHistory.length === 0) && (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartTf === '1J' && intradayHistory.length > 0 ? intradayHistory : patrimoineHistory} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="patG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
              <XAxis dataKey="label" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={58} />
              <Tooltip content={chartTf === '1J' ? intradayTooltip : <TT />} />
              <Area type="monotone" dataKey="Patrimoine" stroke={T.accent} fill="url(#patG)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* RIGHT — donut + KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Donut allocation */}
          <div style={{ ...card }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              {t('accueil_repartition')}
            </div>
            {allocData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={allocData} cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {allocData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fEur(v)} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {allocData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ color: T.textMuted }}>{d.name}</span>
                      </div>
                      <span style={{ color: T.text, fontWeight: 600 }}>
                        {displayPatrimoine > 0 ? `${((d.value / displayPatrimoine) * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: T.textFaint, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>{t('no_data')}</div>
            )}
          </div>

          {/* KPI: Revenus */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>💰 {t('accueil_revenus_mois')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', letterSpacing: '-.03em' }}>{fEur(income, true)}</div>
          </div>

          {/* KPI: Taux épargne */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>🎯 {t('accueil_epargne_rate')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: balance >= 0 ? T.accent : '#f87171', letterSpacing: '-.03em' }}>
              {Math.round(savingsRate)}%
            </div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{fEur(balance)} {t('accueil_saved')}</div>
          </div>

          {/* KPI: Score santé */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>📊 {t('accueil_health_score')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: scoreColor, letterSpacing: '-.03em' }}>{score}</span>
              <span style={{ fontSize: 13, color: T.textMuted }}>/100</span>
            </div>
            <div style={{ background: T.cardBorder, borderRadius: 4, height: 5, overflow: 'hidden' }}>
              <div style={{ width: `${score}%`, height: '100%', background: scoreColor, borderRadius: 4, transition: 'width .5s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Performance globale ────────────────────────────────────────── */}
      <div style={{ ...card }}>
        {/* Header + timeframes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            ⚡ Performance globale
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.keys(PERF_TF_DAYS).map(tf => (
              <button key={tf} onClick={() => setPerfTf(tf)} style={{
                background: perfTf === tf ? T.accent + '26' : 'transparent',
                border: `1px solid ${perfTf === tf ? T.accent : T.cardBorder}`,
                color: perfTf === tf ? T.accent : T.textMuted,
                borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chiffre principal */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, color: perfData.total >= 0 ? '#4ade80' : '#f87171' }}>
            {perfData.total >= 0 ? '+' : ''}{fEur(perfData.total)}
          </div>
          {perfData.invInvestedTotal > 0 && (
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: perfData.invPV >= 0 ? '#4ade80' : '#f87171',
              background: perfData.invPV >= 0 ? 'rgba(16,185,129,.1)' : 'rgba(248,113,113,.1)',
              padding: '4px 12px', borderRadius: 20,
            }}>
              {perfData.invPVPct >= 0 ? '+' : ''}{perfData.invPVPct.toFixed(2)}%
              <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>invest.</span>
            </div>
          )}
        </div>

        {/* Breakdown par source — accordions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            {
              key: 'inv', icon: '📈', label: 'Investissements',
              sublabel: perfTf === 'TOUT' ? 'PV latente totale' : perfTf === '1J' ? 'Variation du jour' : 'PV depuis achat · non filtré',
              value: perfTf === '1J' ? (perfData.invDailyPnl ?? 0) : perfData.invPV,
              nonPeriodic: perfTf !== 'TOUT' && perfTf !== '1J',
              detail: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {perfTf !== 'TOUT' && perfTf !== '1J' && (
                    <div style={{ fontSize: 11, color: T.textFaint, padding: '6px 10px', background: T.bg2, borderRadius: 7, marginBottom: 4 }}>
                      ℹ Pas d'historique de prix disponible — PV affichée depuis la date d'achat, indépendante de la période sélectionnée.
                    </div>
                  )}
                  {perfTf === '1J' && (
                    <div style={{ fontSize: 11, color: T.textFaint, padding: '6px 10px', background: T.bg2, borderRadius: 7, marginBottom: 4 }}>
                      ⚡ Variation intraday calculée via prix temps réel (cours actuels × variation % du jour).
                    </div>
                  )}
                  {(investments || []).length === 0 && <div style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: '6px 0' }}>Aucun investissement</div>}
                  {(investments || []).map(inv => {
                    const val = invLiveValue ? invLiveValue(inv) : (parseFloat(inv.value) || 0);
                    const invested = invLiveInvested ? invLiveInvested(inv) : (parseFloat(inv.invested) || 0);
                    const pv = val - invested; const pvPct = invested > 0 ? (pv / invested) * 100 : 0;
                    const pvCol = pv >= 0 ? '#4ade80' : '#f87171';
                    const isInvOpen = openInvId === inv.id;
                    return (
                      <div key={inv.id} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.cardBorder}` }}>
                        <div
                          onClick={() => setOpenInvId(isInvOpen ? null : inv.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: T.bg2, userSelect: 'none' }}
                          onMouseEnter={e => { e.currentTarget.style.background = T.cardBg; }}
                          onMouseLeave={e => { e.currentTarget.style.background = T.bg2; }}
                        >
                          <span style={{ display: 'inline-block', fontSize: 8, color: T.textFaint, flexShrink: 0, lineHeight: 1, transform: isInvOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>▶</span>
                          <span style={{ fontSize: 14, lineHeight: 1 }}>{TYPE_ICON[inv.type] || '💼'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                            <div style={{ fontSize: 10, color: T.textFaint }}>{inv.type}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fEur(val, true)}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: pvCol }}>{pv >= 0 ? '+' : ''}{fEur(pv, true)} ({pvPct >= 0 ? '+' : ''}{pvPct.toFixed(1)}%)</div>
                          </div>
                        </div>
                        <div style={{ maxHeight: isInvOpen ? 1200 : 0, overflow: 'hidden', transition: 'max-height .28s ease' }}>
                          <div style={{ background: T.bg3 || T.bg2 }}>
                            {(inv.positions || []).length === 0 && <div style={{ padding: '8px 14px', fontSize: 11, color: T.textFaint }}>Aucune position renseignée</div>}
                            {(inv.positions || []).map((p, pi) => {
                              const liveKey = (p.isin || p.ticker || '').toUpperCase();
                              const livePrice = (liveKey && data.prices?.[liveKey]) || p.currentPrice || 0;
                              const posVal = (p.shares || 0) * livePrice;
                              const posBuy = (p.shares || 0) * (p.buyPrice || 0);
                              const posPV = posVal - posBuy; const posPVPct = posBuy > 0 ? (posPV / posBuy) * 100 : 0;
                              const posName = p.name || p.ticker || p.isin || p.commodityType || `Position ${pi + 1}`;

                              // Period % from API (when not TOUT)
                              const priceEntry = liveKey ? perfPrices[`${liveKey}__${perfTf}`] : null;
                              const periodPct = priceEntry?.changePct;
                              const periodLoading = priceEntry?.loading;
                              const usePeriod = perfTf !== 'TOUT' && liveKey;
                              const dispPct = usePeriod ? periodPct : posPVPct;
                              const dispPV  = usePeriod
                                ? (periodPct != null ? posVal * periodPct / 100 : null)
                                : posPV;
                              const posCol = (dispPct ?? 0) >= 0 ? '#4ade80' : '#f87171';

                              return (
                                <div key={p.id || pi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderTop: `1px solid ${T.cardBorder}` }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{posName}</div>
                                    <div style={{ fontSize: 10, color: T.textFaint }}>{p.shares} × {fEur(livePrice, true)}</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{fEur(posVal, true)}</div>
                                    {periodLoading && usePeriod
                                      ? <div style={{ fontSize: 10, color: T.textFaint }}>…</div>
                                      : (dispPct != null || (!usePeriod && posBuy > 0)) && (
                                        <div style={{ fontSize: 10, color: posCol }}>
                                          {dispPV != null ? `${dispPV >= 0 ? '+' : ''}${fEur(dispPV, true)} ` : ''}
                                          ({(dispPct ?? 0) >= 0 ? '+' : ''}{(dispPct ?? 0).toFixed(2)}%)
                                        </div>
                                      )
                                    }
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ),
            },
            {
              key: 'revenus', icon: '💰', label: 'Revenus cumulés', value: perfData.revenues,
              detail: (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {perfDetail.revenusRows.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: '6px 0' }}>Aucun revenu sur la période</div>}
                  {perfDetail.revenusRows.map(tx => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
                        <div style={{ fontSize: 10, color: T.textFaint }}>{tx.category} · {fDate(tx.date)}</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>+{fEur(tx.amount, true)}</span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'depenses', icon: '💸', label: 'Dépenses cumulées', value: perfData.depenses,
              detail: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {perfDetail.depGroups.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: '6px 0' }}>Aucune dépense sur la période</div>}
                  {perfDetail.depGroups.map(({ cat, txs, total }) => {
                    const isCatOpen = openCat === cat;
                    return (
                      <div key={cat} style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.cardBorder}` }}>
                        <div
                          onClick={() => setOpenCat(isCatOpen ? null : cat)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', background: T.bg2, userSelect: 'none' }}
                          onMouseEnter={e => { e.currentTarget.style.background = T.cardBg; }}
                          onMouseLeave={e => { e.currentTarget.style.background = T.bg2; }}
                        >
                          <span style={{ display: 'inline-block', fontSize: 8, color: T.textFaint, flexShrink: 0, lineHeight: 1, transform: isCatOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>▶</span>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat] || '#94a3b8', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12, color: T.text }}>{cat}</span>
                          <span style={{ fontSize: 10, color: T.textFaint, marginRight: 6 }}>{txs.length} tx</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>−{fEur(total, true)}</span>
                        </div>
                        <div style={{ maxHeight: isCatOpen ? 600 : 0, overflow: 'hidden', transition: 'max-height .22s ease' }}>
                          <div style={{ background: T.bg3 || T.bg2 }}>
                            {txs.map(tx => (
                              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderTop: `1px solid ${T.cardBorder}` }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
                                  <div style={{ fontSize: 10, color: T.textFaint }}>{fDate(tx.date)}</div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#f87171', flexShrink: 0 }}>{fEur(tx.amount, true)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ),
            },
            {
              key: 'ventes', icon: '🏷️', label: 'Ventes réalisées', value: perfData.ventes,
              detail: (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {perfDetail.ventesRows.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', padding: '6px 0' }}>Aucune vente sur la période</div>}
                  {perfDetail.ventesRows.map((item, i) => {
                    const profit = parseFloat(item.profit) || 0;
                    const profitCol = profit >= 0 ? '#4ade80' : '#f87171';
                    return (
                      <div key={item.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontSize: 10, color: T.textFaint }}>
                            {fDate(item.soldDate)} · {fEur(item.buyPrice, true)} → {fEur(item.sellPrice, true)}
                            {item.fees > 0 ? ` · frais ${fEur(item.fees, true)}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: profitCol, flexShrink: 0 }}>{profit >= 0 ? '+' : ''}{fEur(profit, true)}</span>
                      </div>
                    );
                  })}
                </div>
              ),
            },
            {
              key: 'epargne', icon: '🎯', label: 'Épargne nette', sublabel: 'revenus − dépenses', value: perfData.epargneNette,
              detail: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>💰 Revenus</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>+{fEur(perfData.revenues, true)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>💸 Dépenses</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>{fEur(perfData.depenses, true)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>= Épargne nette</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: perfData.epargneNette >= 0 ? '#4ade80' : '#f87171' }}>
                      {perfData.epargneNette >= 0 ? '+' : ''}{fEur(perfData.epargneNette, true)}
                    </span>
                  </div>
                  {perfData.revenues > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <div style={{ flex: 1, background: T.cardBorder, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, (perfData.epargneNette / perfData.revenues) * 100))}%`, height: '100%', background: perfData.epargneNette >= 0 ? T.accent : '#f87171', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: perfData.epargneNette >= 0 ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                        {((perfData.epargneNette / perfData.revenues) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              ),
            },
          ].map(({ key, icon, label, sublabel, value, detail, nonPeriodic }) => {
            const isOpen = openPerf === key;
            const isZero = Math.abs(value) < 0.01;
            // nonPeriodic = ligne investissements hors période TOUT : pas de barre de contribution
            const color = isZero ? T.textFaint : nonPeriodic ? T.textMuted : value >= 0 ? '#4ade80' : '#f87171';
            const absTot = nonPeriodic ? 0 : Math.abs(perfData.total);
            const contribPct = absTot > 0 ? (Math.abs(value) / absTot) * 100 : 0;
            return (
              <div key={key} style={{ borderRadius: 12, overflow: 'hidden', opacity: nonPeriodic ? 0.72 : 1 }}>
                {/* Clickable header */}
                <div
                  role="button" tabIndex={0}
                  onClick={() => setOpenPerf(isOpen ? null : key)}
                  onKeyDown={e => e.key === 'Enter' && setOpenPerf(isOpen ? null : key)}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = T.cardBg; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = T.bg2; }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isOpen ? T.cardBg : T.bg2, cursor: 'pointer', userSelect: 'none', transition: 'background .15s' }}
                >
                  <span style={{ display: 'inline-block', fontSize: 8, color: T.textFaint, flexShrink: 0, lineHeight: 1, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .22s ease' }}>▶</span>
                  <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{label}</span>
                        {sublabel && <span style={{ fontSize: 10, color: T.textFaint, marginLeft: 6 }}>{sublabel}</span>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color, whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {!isZero && value > 0 && !nonPeriodic ? '+' : ''}{isZero ? '—' : fEur(value, true)}
                      </span>
                    </div>
                    {!isZero && !nonPeriodic && absTot > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                        <div style={{ flex: 1, background: T.cardBorder, borderRadius: 3, height: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, contribPct)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
                        </div>
                        <span style={{ fontSize: 10, color: T.textFaint, whiteSpace: 'nowrap', minWidth: 30, textAlign: 'right' }}>{contribPct.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Collapsible detail */}
                <div style={{ maxHeight: isOpen ? 2400 : 0, overflow: 'hidden', transition: 'max-height .32s ease' }}>
                  <div style={{ padding: '10px 14px 14px', background: T.bg3 || T.bg2, borderTop: `1px solid ${T.cardBorder}` }}>
                    {detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Trophées & Statut ─────────────────────────────────────────── */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            🏆 Trophées & Statut
          </div>
          <span style={{ fontSize: 11, color: T.textFaint }}>Menu ≡ → Trophées pour le détail</span>
        </div>

        {/* Status + progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>{trophyResult.status.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{trophyResult.status.label}</div>
              <div style={{ fontSize: 11, color: T.textFaint }}>{trophyResult.totalPoints} pts</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: T.textFaint }}>
              <span>{trophyResult.status.icon} {trophyResult.status.label}</span>
              {trophyResult.nextStatus && <span>{trophyResult.nextStatus.icon} {trophyResult.nextStatus.label}</span>}
            </div>
            <div style={{ background: T.cardBorder, borderRadius: 6, height: 7, overflow: 'hidden' }}>
              <div style={{ width: `${trophyResult.progressPct}%`, height: '100%', background: `linear-gradient(90deg,${T.accent || '#10b981'},${T.accent || '#10b981'}cc)`, borderRadius: 6, transition: 'width .5s' }} />
            </div>
            {trophyResult.nextStatus && (
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3, textAlign: 'right' }}>
                {trophyResult.pointsToNext} pts pour {trophyResult.nextStatus.label}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.accent || '#10b981', letterSpacing: '-.03em' }}>{trophyResult.unlockedCount}</div>
            <div style={{ fontSize: 10, color: T.textFaint }}>/ {trophyResult.totalCount} trophées</div>
          </div>
        </div>

        {/* Recent unlocked trophies */}
        {trophyResult.unlockedCount > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {trophyResult.trophies.filter(t => t.unlocked).slice(0, 6).map(t => (
              <div key={t.id} title={`${t.name} — ${t.desc} (+${t.pts} pts)`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: (T.accent || '#10b981') + '12', border: `1px solid ${(T.accent || '#10b981')}33`, borderRadius: 20 }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text, whiteSpace: 'nowrap' }}>{t.name}</span>
              </div>
            ))}
            {trophyResult.unlockedCount > 6 && (
              <div style={{ padding: '5px 10px', background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 20, fontSize: 11, color: T.textMuted }}>
                +{trophyResult.unlockedCount - 6} autres
              </div>
            )}
          </div>
        )}
        {trophyResult.unlockedCount === 0 && (
          <div style={{ fontSize: 13, color: T.textFaint, textAlign: 'center', padding: '12px 0' }}>Aucun trophée débloqué pour l'instant 🔒</div>
        )}
      </div>

      <Confetti active={showConfetti} onDone={handleConfettiDone} />

      {/* ── Asset cards horizontal scroll ──────────────────────────────── */}
      {assetCards.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            {t('accueil_repartition')}
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
            {assetCards.map(c => (
              <AssetCard
                key={c.id}
                T={T}
                name={c.name}
                type={c.type}
                value={c.value}
                pnlPct={c.pnlPct}
                seed={c.seed}
                onClick={c.id.startsWith('__') ? () => setTab('patrimoine') : () => setTab('patrimoine')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Goals ──────────────────────────────────────────────────────── */}
      {goals.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('accueil_objectifs')}</h3>
            <button onClick={() => setTab('budget')} style={{ ...S.btnS, padding: '4px 12px', fontSize: 11 }}>{t('see_all')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
            {goals.map(g => {
              const pct = Math.min(100, (displayPatrimoine / g.target) * 100);
              const monthsLeft = Math.max(0, Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)));
              return (
                <div key={g.id} style={{ background: T.bg2, borderRadius: 12, padding: 14, borderLeft: `3px solid ${g.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{monthsLeft} {t('months')}</span>
                  </div>
                  <div style={{ background: T.cardBorder, borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: g.color, borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: g.color, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                    <span style={{ color: T.textMuted }}>{fEur(displayPatrimoine, true)} / {fEur(g.target, true)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Last transactions ───────────────────────────────────────────── */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('accueil_last_tx')}</h3>
          <button onClick={() => setTab('flux')} style={{ ...S.btnS, padding: '4px 12px', fontSize: 11 }}>{t('see_all')}</button>
        </div>
        {transactions.length === 0 ? (
          <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>{t('accueil_no_tx')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transactions.slice(0, 6).map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.bg2, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: tx.type === 'income' ? 'rgba(16,185,129,.12)' : 'rgba(248,113,113,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    {tx.type === 'income' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                      {tx.label}
                      {tx.recurrent && <span style={{ fontSize: 9, background: 'rgba(96,165,250,.15)', color: '#60a5fa', padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>↻</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint }}>{tx.category} · {fDate(tx.date)}</div>
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: tx.amount > 0 ? '#4ade80' : '#f87171' }}>
                  {tx.amount > 0 ? '+' : ''}{fEur(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile-only KPI row ─────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .accueil-top-grid { grid-template-columns: 1fr !important; }
        }
        .asset-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
