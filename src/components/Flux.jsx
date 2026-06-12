import { useState, useMemo, useRef, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { KPI, TT, makeS, fEur, fDate, MONTHS, CAT_COLORS } from '../utils/constants';
import { parseCSV } from '../hooks/useData';
import { useTranslation } from '../hooks/useTranslation';

export default function Flux({ T, data }) {
  const S = makeS(T);
  const { t } = useTranslation();
  const [fluxCat, setFluxCat] = useState('Tout');
  const [fluxMonth, setFluxMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [forecastDays, setForecastDays] = useState(30);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [csvRows, setCsvRows] = useState(null);
  const [csvSelected, setCsvSelected] = useState(new Set());
  const [csvImported, setCsvImported] = useState(null);
  const fileInputRef = useRef(null);

  const { transactions, income, expense, balance, savingsRate, monthlyData,
    setModal, setEditItem, setTxForm, delTx, openEditTx, exportCSV, mkTx, allAccounts,
    computeForecast, importTransactions } = data;

  const monthOptions = useMemo(() => {
    const n = new Date();
    const opts = [{ value: 'all', label: t('flux_all_months') }];
    for (let i = 0; i < 12; i++) {
      const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
      opts.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  }, [t]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const monthOk = fluxMonth === 'all' || t.date.startsWith(fluxMonth);
      const catOk = fluxCat === 'Tout' || t.category === fluxCat;
      return monthOk && catOk;
    });
  }, [transactions, fluxMonth, fluxCat]);

  const forecastData = useMemo(() => computeForecast(forecastDays), [computeForecast, forecastDays]);
  const forecastNeg = forecastData.some(p => p.neg);
  const forecastMin = Math.min(...forecastData.map(p => p.balance));
  const forecastMax = Math.max(...forecastData.map(p => p.balance));

  // ── Comparaison mois/mois ─────────────────────────────────────────────────
  const { monthComparison, topGains, subscriptions, totalSubsMonthly, missedSubs } = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth(), cy = now.getFullYear();
    const pm = cm === 0 ? 11 : cm - 1;
    const py = cm === 0 ? cy - 1 : cy;
    const currYM = `${cy}-${String(cm + 1).padStart(2, '0')}`;
    const prevYM = `${py}-${String(pm + 1).padStart(2, '0')}`;

    const currByCat = {}, prevByCat = {};
    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      if (t.date.startsWith(currYM)) currByCat[t.category] = (currByCat[t.category] || 0) + Math.abs(t.amount);
      if (t.date.startsWith(prevYM)) prevByCat[t.category] = (prevByCat[t.category] || 0) + Math.abs(t.amount);
    });

    const allCats = [...new Set([...Object.keys(currByCat), ...Object.keys(prevByCat)])];
    const mc = allCats.map(cat => {
      const curr = currByCat[cat] || 0;
      const prev = prevByCat[cat] || 0;
      const diff = curr - prev;
      const pct = prev > 0 ? (diff / prev) * 100 : (curr > 0 ? 100 : 0);
      return { cat, curr, prev, diff, pct };
    }).sort((a, b) => b.curr - a.curr);

    const tg = [...mc].filter(x => Math.abs(x.pct) >= 5 && x.prev > 0).sort((a,b) => b.pct - a.pct);

    // Subscriptions detection
    const subMap = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const key = `${t.label.trim().toLowerCase()}|${Math.round(Math.abs(t.amount))}`;
      if (!subMap[key]) subMap[key] = { label: t.label, amount: Math.abs(t.amount), months: new Set(), recurrent: false };
      subMap[key].months.add(t.date.slice(0, 7));
      if (t.recurrent || t.recurrentSourceId) subMap[key].recurrent = true;
    });
    const subs = Object.values(subMap)
      .filter(s => s.months.size >= 2 || s.recurrent)
      .map(s => ({ ...s, monthCount: s.months.size, presentThisMonth: s.months.has(currYM) }))
      .sort((a, b) => b.amount - a.amount);
    const tSubs = subs.reduce((s, sub) => s + sub.amount, 0);
    const missed = subs.filter(s => !s.presentThisMonth && s.monthCount >= 2);

    return { monthComparison: mc, topGains: tg, subscriptions: subs, totalSubsMonthly: tSubs, missedSubs: missed };
  }, [transactions]);

  const cats = ['Tout', ...Object.keys(CAT_COLORS)];

  // ── CSV import ─────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const isDup = (r) => transactions.some(
        t => t.date === r.date && Math.abs(t.amount) === Math.abs(r.amount) && t.label === r.label
      );
      const annotated = rows.map(r => ({ ...r, isDup: isDup(r) }));
      setCsvRows(annotated);
      setCsvSelected(new Set(annotated.filter(r => !r.isDup).map((_, i) => i)));
      setCsvImported(null);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [transactions]);

  const confirmImport = () => {
    const toImport = csvRows.filter((_, i) => csvSelected.has(i));
    const count = importTransactions(toImport);
    setCsvImported(count);
    setCsvRows(null);
    setCsvSelected(new Set());
  };

  const toggleCsvRow = (i) => {
    setCsvSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>{t('flux_title')}</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>{t('flux_subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={exportCSV} style={{ ...S.btnS, fontSize: 12, padding: '7px 14px' }}>{t('flux_export_csv')}</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...S.btnS, fontSize: 12, padding: '7px 14px' }}>{t('flux_import_csv')}</button>
          <button onClick={() => { setEditItem(null); setTxForm(mkTx()); setModal('tx'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>{t('flux_add_tx')}</button>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {csvImported !== null && (
        <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#4ade80', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('flux_imported', csvImported, csvImported > 1 ? 's' : '')}</span>
          <button onClick={() => setCsvImported(null)} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* CSV Preview */}
      {csvRows && (
        <div style={{ ...S.card, borderColor: '#60a5fa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t('flux_csv_preview')}</h3>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{t('flux_csv_rows', csvRows.length, csvRows.length > 1 ? 's' : '')} · {t('flux_csv_selected', csvSelected.size, csvSelected.size > 1 ? 's' : '')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setCsvRows(null); setCsvSelected(new Set()); }} style={{ ...S.btnS, fontSize: 12, padding: '6px 12px' }}>{t('cancel')}</button>
              <button onClick={confirmImport} disabled={csvSelected.size === 0} style={{ ...S.btnG, fontSize: 12, padding: '6px 14px', opacity: csvSelected.size === 0 ? 0.5 : 1 }}>
                {t('flux_csv_import_btn', csvSelected.size > 0 ? csvSelected.size : '')}
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {csvRows.map((r, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: r.isDup ? 'rgba(251,146,60,.06)' : csvSelected.has(i) ? 'rgba(16,185,129,.06)' : T.bg2, borderRadius: 8, cursor: 'pointer', opacity: r.isDup ? 0.6 : 1 }}>
                <input type="checkbox" checked={csvSelected.has(i)} onChange={() => toggleCsvRow(i)} style={{ accentColor: '#10b981', width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T.textFaint, minWidth: 80, flexShrink: 0 }}>{fDate(r.date)}</span>
                <span style={{ fontSize: 12, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span style={{ fontSize: 11, color: T.textMuted, minWidth: 70, flexShrink: 0 }}>{r.category}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: r.amount >= 0 ? '#4ade80' : '#f87171', minWidth: 80, textAlign: 'right', flexShrink: 0 }}>
                  {r.amount >= 0 ? '+' : ''}{fEur(r.amount)}
                </span>
                {r.isDup && <span style={{ fontSize: 10, color: '#fb923c', flexShrink: 0 }}>{t('duplicate')}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="g4">
        <KPI T={T} label={t('flux_kpi_income')} value={fEur(income, true)} accent="#4ade80" icon="↓" />
        <KPI T={T} label={t('flux_kpi_expense')} value={fEur(expense, true)} accent="#f87171" icon="↑" />
        <KPI T={T} label={t('flux_kpi_balance')} value={fEur(balance, true)} accent={balance >= 0 ? T.accent : '#f87171'} icon="⚖" />
        <KPI T={T} label={t('flux_kpi_rate')} value={Math.round(savingsRate) + '%'} accent={T.accent} icon="🎯" />
      </div>

      {/* Analyse toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowAnalysis(p => !p)}
          style={{ ...S.btnS, fontSize: 12, padding: '7px 16px', background: showAnalysis ? 'rgba(96,165,250,.12)' : T.cardBg, borderColor: showAnalysis ? '#60a5fa' : T.cardBorder, color: showAnalysis ? '#60a5fa' : T.textMuted }}>
          {showAnalysis ? '▾' : '▸'} {t('flux_analysis')}
          {missedSubs.length > 0 && <span style={{ marginLeft: 8, fontSize: 10, background: 'rgba(251,146,60,.2)', color: '#fb923c', padding: '2px 6px', borderRadius: 4 }}>{t('flux_alert_n', missedSubs.length, missedSubs.length > 1 ? 's' : '')}</span>}
        </button>
      </div>

      {showAnalysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Comparaison mois/mois ── */}
          <div style={{ ...S.card }}>
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('flux_comparison')}</h3>
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                {MONTHS[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1]} → {MONTHS[new Date().getMonth()]}
              </p>
            </div>

            {topGains.length > 0 && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: topGains[0].diff > 0 ? 'rgba(248,113,113,.08)' : 'rgba(74,222,128,.08)', border: `1px solid ${topGains[0].diff > 0 ? 'rgba(248,113,113,.2)' : 'rgba(74,222,128,.2)'}`, borderRadius: 10, fontSize: 13 }}>
                {topGains[0].diff > 0
                  ? `Tu as dépensé ${Math.abs(topGains[0].pct).toFixed(0)}% de plus en ${topGains[0].cat} ce mois (+${fEur(topGains[0].diff)})`
                  : `Tu as dépensé ${Math.abs(topGains[0].pct).toFixed(0)}% de moins en ${topGains[0].cat} ce mois (${fEur(topGains[0].diff)})`
                }
              </div>
            )}

            {monthComparison.length === 0 ? (
              <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{t('flux_no_data')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px', gap: 8, padding: '6px 10px', fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <span>{t('flux_col_cat')}</span><span style={{ textAlign: 'right' }}>{t('flux_col_prev')}</span><span style={{ textAlign: 'right' }}>{t('flux_col_curr')}</span><span style={{ textAlign: 'right' }}>{t('flux_col_diff')}</span>
                </div>
                {monthComparison.map(({ cat, curr, prev, diff, pct }) => (
                  <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px', gap: 8, padding: '8px 10px', background: T.bg2, borderRadius: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: CAT_COLORS[cat] || '#94a3b8', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: T.text }}>{cat}</span>
                    </div>
                    <span style={{ fontSize: 12, color: T.textMuted, textAlign: 'right' }}>{prev > 0 ? fEur(prev) : '—'}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: 'right' }}>{curr > 0 ? fEur(curr) : '—'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                      {diff !== 0 && prev > 0 ? (
                        <>
                          <span style={{ fontSize: 14 }}>{diff > 0 ? '↑' : '↓'}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: diff > 0 ? '#f87171' : '#4ade80' }}>
                            {diff > 0 ? '+' : ''}{fEur(diff)} ({Math.abs(pct).toFixed(0)}%)
                          </span>
                        </>
                      ) : curr > 0 && prev === 0 ? (
                        <span style={{ fontSize: 10, color: '#fb923c' }}>{t('new_label')}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Détection abonnements ── */}
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('flux_subs_title')}</h3>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{t('flux_subs_subtitle')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{fEur(totalSubsMonthly)}<span style={{ fontSize: 11, fontWeight: 400, color: T.textMuted }}>{t('per_month')}</span></div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{fEur(totalSubsMonthly * 12)}{t('per_year')}</div>
              </div>
            </div>

            {missedSubs.length > 0 && (
              <div style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fb923c', marginBottom: 6 }}>{t('flux_subs_warning')}</div>
                {missedSubs.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#fb923c', padding: '2px 0' }}>· {s.label} — {fEur(s.amount)}{t('per_month')} ({t('flux_subs_history', s.monthCount)})</div>
                ))}
              </div>
            )}

            {subscriptions.length === 0 ? (
              <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{t('flux_no_subs')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {subscriptions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.bg2, borderRadius: 10, opacity: s.presentThisMonth ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', align: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: T.text }}>
                          {s.label}
                          {s.recurrent && <span style={{ fontSize: 9, background: 'rgba(96,165,250,.15)', color: '#60a5fa', padding: '1px 5px', borderRadius: 4 }}>↻</span>}
                          {!s.presentThisMonth && <span style={{ fontSize: 9, background: 'rgba(251,146,60,.15)', color: '#fb923c', padding: '1px 5px', borderRadius: 4 }}>{t('flux_subs_absent')}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint }}>{t('flux_subs_history', s.monthCount)} · {fEur(s.amount * 12)}{t('per_year')}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{fEur(s.amount)}{t('per_month')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6-month chart */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>{t('flux_chart_title')}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
            <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={50} />
            <Tooltip content={<TT />} />
            <Bar dataKey="Revenus" fill={T.accent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Dépenses" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cash-flow forecast */}
      <div style={{ ...S.card, borderColor: forecastNeg ? 'rgba(248,113,113,.4)' : T.cardBorder }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('flux_forecast_title')}</h3>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{t('flux_forecast_subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[30, 60, 90].map(d => (
              <button key={d} onClick={() => setForecastDays(d)}
                style={{ ...S.btnS, fontSize: 11, padding: '5px 12px', background: forecastDays === d ? 'rgba(96,165,250,.15)' : T.cardBg, borderColor: forecastDays === d ? '#60a5fa' : T.cardBorder, color: forecastDays === d ? '#60a5fa' : T.textMuted }}>
                {d}j
              </button>
            ))}
          </div>
        </div>

        {forecastNeg && (
          <div style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('flux_forecast_negative', fEur(forecastMin), forecastDays)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            <span style={{ fontWeight: 700, color: forecastData[forecastData.length - 1]?.balance < 0 ? '#f87171' : '#4ade80' }}>
              {t('flux_forecast_balance', forecastDays, fEur(forecastData[forecastData.length - 1]?.balance || 0))}
            </span>
          </div>
          {forecastMin < forecastMax && (
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {t('flux_forecast_min')} <span style={{ color: forecastMin < 0 ? '#f87171' : T.text, fontWeight: 600 }}>{fEur(forecastMin)}</span>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={forecastData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
            <XAxis dataKey="label" tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={52} />
            <Tooltip formatter={(v) => [fEur(v), 'Solde']} labelStyle={{ color: T.textMuted, fontSize: 11 }} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 3" strokeWidth={1} />
            <Line type="monotone" dataKey="balance" stroke={forecastNeg ? '#fb923c' : '#60a5fa'} strokeWidth={2} dot={(p) => p.payload.neg ? <circle key={p.key} cx={p.cx} cy={p.cy} r={3} fill="#f87171" /> : <circle key={p.key} cx={p.cx} cy={p.cy} r={2} fill="#60a5fa" />} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={fluxMonth} onChange={e => setFluxMonth(e.target.value)}
          style={{ ...S.inp, width: 'auto', padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFluxCat(c)}
              style={{ background: fluxCat === c ? (CAT_COLORS[c] ? CAT_COLORS[c] + '22' : 'rgba(16,185,129,.12)') : 'transparent', border: `1px solid ${fluxCat === c ? (CAT_COLORS[c] || '#10b981') : T.cardBorder}`, color: fluxCat === c ? (CAT_COLORS[c] || '#10b981') : T.textMuted, borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: fluxCat === c ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {c === 'Tout' ? t('flux_filter_all') : c}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('flux_tx_list', filtered.length)}</h3>
        </div>
        {filtered.length === 0 ? (
          <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>{t('flux_no_tx')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filtered.map(t => {
              const isTransfer = t.type === 'transfer';
              const isRepayment = t.type === 'loan_repayment';
              const isGenerated = Boolean(t.recurrentSourceId);
              const srcAcct = allAccounts.find(a => a.id === t.accountId);
              const dstAcct = allAccounts.find(a => a.id === t.destAccountId);
              const dotColor = isTransfer ? '#60a5fa' : isRepayment ? '#a78bfa' : (CAT_COLORS[t.category] || '#6b7280');
              const amtColor = isTransfer ? '#60a5fa' : isRepayment ? '#a78bfa' : t.amount > 0 ? '#4ade80' : '#f87171';
              const amtLabel = isTransfer ? `⇄ ${fEur(t.amount)}` : (t.amount > 0 ? '+' : '') + fEur(t.amount);
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.bg2, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                        {(t.recurrent || isGenerated) && (
                          <span style={{ fontSize: 9, background: isGenerated ? 'rgba(251,146,60,.15)' : 'rgba(96,165,250,.15)', color: isGenerated ? '#fb923c' : '#60a5fa', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>↻</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint }}>
                        {isTransfer
                          ? <>{fDate(t.date)} · {srcAcct?.name || '?'} <span style={{ color: '#60a5fa' }}>→</span> {dstAcct?.name || '?'}</>
                          : <>{t.category} · {fDate(t.date)}{srcAcct ? <> · <span style={{ color: dotColor }}>{srcAcct.name}</span></> : null}</>
                        }
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: amtColor, minWidth: 80, textAlign: 'right' }}>
                      {amtLabel}
                    </span>
                    <button onClick={() => openEditTx(t)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                    <button onClick={() => delTx(t.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
