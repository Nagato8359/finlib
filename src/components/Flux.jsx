import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KPI, TT, makeS, fEur, fDate, MONTHS, CAT_COLORS } from '../utils/constants';

export default function Flux({ T, data }) {
  const S = makeS(T);
  const [fluxCat, setFluxCat] = useState('Tout');
  const [fluxMonth, setFluxMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  const { transactions, income, expense, balance, savingsRate, monthlyData, setModal, setEditItem, setTxForm, delTx, openEditTx, exportCSV, mkTx } = data;

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts = [{ value: 'all', label: 'Tous les mois' }];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const monthOk = fluxMonth === 'all' || t.date.startsWith(fluxMonth);
      const catOk = fluxCat === 'Tout' || t.category === fluxCat;
      return monthOk && catOk;
    });
  }, [transactions, fluxMonth, fluxCat]);

  const cats = ['Tout', ...Object.keys(CAT_COLORS)];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>Flux de trésorerie</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Toutes vos entrées et sorties</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ ...S.btnS, fontSize: 12, padding: '7px 14px' }}>↓ CSV</button>
          <button onClick={() => { setEditItem(null); setTxForm(mkTx()); setModal('tx'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Transaction</button>
        </div>
      </div>

      <div className="g4">
        <KPI T={T} label="Revenus" value={fEur(income, true)} accent="#4ade80" icon="↓" />
        <KPI T={T} label="Dépenses" value={fEur(expense, true)} accent="#f87171" icon="↑" />
        <KPI T={T} label="Solde net" value={fEur(balance, true)} accent={balance >= 0 ? '#10b981' : '#f87171'} icon="⚖" />
        <KPI T={T} label="Taux d'épargne" value={Math.round(savingsRate) + '%'} accent="#10b981" icon="🎯" />
      </div>

      {/* 6-month chart */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Revenus vs Dépenses — 6 mois</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
            <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={50} />
            <Tooltip content={<TT />} />
            <Bar dataKey="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Dépenses" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
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
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Transactions ({filtered.length})</h3>
        </div>
        {filtered.length === 0 ? (
          <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Aucune transaction pour ces filtres</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.bg2, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[t.category] || '#6b7280', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                      {t.recurrent && <span style={{ fontSize: 9, background: 'rgba(96,165,250,.15)', color: '#60a5fa', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>↻</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint }}>{t.category} · {fDate(t.date)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: t.amount > 0 ? '#4ade80' : '#f87171', minWidth: 80, textAlign: 'right' }}>
                    {t.amount > 0 ? '+' : ''}{fEur(t.amount)}
                  </span>
                  <button onClick={() => openEditTx(t)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                  <button onClick={() => delTx(t.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
