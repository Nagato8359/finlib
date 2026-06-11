import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { KPI, TT, makeS, fEur, fPct, fDate, MONTHS } from '../utils/constants';

const TF_DAYS = { '1J': 1, '7J': 7, '1M': 30, '3M': 90, '1AN': 365 };

export default function Accueil({ T, data, setTab }) {
  const S = makeS(T);
  const [chartTf, setChartTf] = useState('1M');

  const {
    transactions, patrimoine, patrimoineNet, linkedLoanDebt,
    invTotal, cashTotal, healthTotal,
    income, balance, savingsRate, score, alerts,
    goals, pnlTotal, invInvested, healthCost, catData,
  } = data;

  const patrimoineHistory = useMemo(() => {
    const days = TF_DAYS[chartTf] || 30;
    const step = days <= 7 ? 1 : days <= 30 ? 2 : days <= 90 ? 7 : 30;
    const now = new Date();
    const points = [];
    const seen = new Set();
    const baseNet = patrimoineNet ?? patrimoine;
    for (let i = days; i >= 0; i -= step) {
      const date = new Date(now.getTime() - i * 86400000);
      const futureTx = transactions.filter(t => new Date(t.date) > date && new Date(t.date) <= now);
      const cashDiff = futureTx.reduce((s, t) => s + t.amount, 0);
      const val = Math.max(0, baseNet - cashDiff);
      const label = days <= 7
        ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
        : days <= 30
        ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : MONTHS[date.getMonth()] + (days > 90 ? ` ${date.getFullYear().toString().slice(2)}` : '');
      if (!seen.has(label)) { seen.add(label); points.push({ label, Patrimoine: val }); }
    }
    points.push({ label: 'Auj.', Patrimoine: Math.round(baseNet) });
    return points;
  }, [chartTf, transactions, patrimoine, patrimoineNet]);

  const displayPatrimoine = patrimoineNet ?? patrimoine;
  const change = patrimoineHistory.length > 1 ? displayPatrimoine - patrimoineHistory[0].Patrimoine : 0;
  const changePct = patrimoineHistory.length > 1 && patrimoineHistory[0].Patrimoine > 0
    ? (change / patrimoineHistory[0].Patrimoine) * 100 : 0;

  const scoreColor = score >= 70 ? '#4ade80' : score >= 40 ? '#fb923c' : '#f87171';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Patrimoine hero + chart */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Patrimoine total{linkedLoanDebt > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: T.textFaint, fontWeight: 400 }}>valeur nette</span>}
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.04em', color: T.text }}>{fEur(displayPatrimoine)}</div>
            {linkedLoanDebt > 0 && (
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 2 }}>
                Brut : {fEur(patrimoine)} · Dettes immo : <span style={{ color: '#f87171' }}>−{fEur(linkedLoanDebt)}</span>
              </div>
            )}
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: change >= 0 ? '#4ade80' : '#f87171' }}>
                {change >= 0 ? '+' : ''}{fEur(change, true)} ({fPct(changePct)})
              </span>
              <span style={{ fontSize: 12, color: T.textMuted }}>sur {chartTf}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {Object.keys(TF_DAYS).map(tf => (
              <button key={tf} onClick={() => setChartTf(tf)}
                style={{ background: chartTf === tf ? 'rgba(16,185,129,.15)' : 'transparent', border: `1px solid ${chartTf === tf ? '#10b981' : T.cardBorder}`, color: chartTf === tf ? '#10b981' : T.textMuted, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={patrimoineHistory} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="patG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
            <XAxis dataKey="label" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={55} />
            <Tooltip content={<TT />} />
            <Area type="monotone" dataKey="Patrimoine" stroke="#10b981" fill="url(#patG)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map((a, i) => <div key={i} style={{ fontSize: 13, color: '#fb923c' }}>⚠ {a.msg}</div>)}
        </div>
      )}

      {/* KPIs */}
      <div className="g4">
        <KPI T={T} label="Patrimoine total" value={fEur(displayPatrimoine, true)}
          sub={fPct((pnlTotal / Math.max(1, invInvested + healthCost)) * 100)} icon="🏛️" />
        <KPI T={T} label="Revenus du mois" value={fEur(income, true)} accent="#4ade80" icon="💰" />
        <KPI T={T} label="Taux d'épargne" value={Math.round(savingsRate) + '%'}
          sub={fEur(balance) + ' épargnés'} accent={balance >= 0 ? '#10b981' : '#f87171'} icon="🎯" />
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Score santé</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor }}>{score}<span style={{ fontSize: 13, fontWeight: 400, color: T.textMuted }}>/100</span></div>
          <div style={{ background: T.cardBorder, borderRadius: 4, height: 4, overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', background: scoreColor, borderRadius: 4, transition: 'width .5s' }} />
          </div>
        </div>
      </div>

      {/* Patrimoine breakdown + Pie */}
      <div className="g21">
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Répartition du patrimoine</h3>
          {[
            { label: linkedLoanDebt > 0 ? 'Investissements (net)' : 'Investissements', val: invTotal - (linkedLoanDebt || 0), color: '#10b981', icon: '📈', onClick: () => setTab('patrimoine') },
            { label: 'Épargne & Cash', val: cashTotal, color: '#34d399', icon: '🏦', onClick: () => setTab('patrimoine') },
            { label: 'Patrimoine matériel', val: healthTotal, color: '#60a5fa', icon: '🏠', onClick: () => setTab('patrimoine') },
          ].map(({ label, val, color, icon, onClick }) => (
            <div key={label} onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.cardBorder}`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</div>
                <span style={{ fontSize: 14, color: T.text }}>{label}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color }}>{fEur(val, true)}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{displayPatrimoine > 0 ? ((val / displayPatrimoine) * 100).toFixed(0) : 0}%</div>
              </div>
            </div>
          ))}
        </div>
        {catData.length > 0 ? (
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Dépenses ce mois</h3>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                  {catData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v => fEur(v)} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
              {catData.slice(0, 4).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                    <span style={{ color: T.textMuted }}>{c.name}</span>
                  </div>
                  <span style={{ color: T.text, fontWeight: 500 }}>{fEur(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>
            Aucune dépense ce mois
          </div>
        )}
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Objectifs financiers</h3>
            <button onClick={() => setTab('budget')} style={{ ...S.btnS, padding: '4px 12px', fontSize: 11 }}>Voir tout →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {goals.map(g => {
              const pct = Math.min(100, (displayPatrimoine / g.target) * 100);
              const monthsLeft = Math.max(0, Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)));
              return (
                <div key={g.id} style={{ background: T.bg2, borderRadius: 12, padding: 14, borderLeft: `3px solid ${g.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{monthsLeft} mois</span>
                  </div>
                  <div style={{ background: T.cardBorder, borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 }}>
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

      {/* Last transactions */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Dernières transactions</h3>
          <button onClick={() => setTab('flux')} style={{ ...S.btnS, padding: '4px 12px', fontSize: 11 }}>Voir tout →</button>
        </div>
        {transactions.length === 0 ? (
          <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Aucune transaction — allez dans Flux pour en ajouter</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transactions.slice(0, 6).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.bg2, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: t.type === 'income' ? 'rgba(16,185,129,.12)' : 'rgba(248,113,113,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    {t.type === 'income' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                      {t.label}
                      {t.recurrent && <span style={{ fontSize: 9, background: 'rgba(96,165,250,.15)', color: '#60a5fa', padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>↻</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint }}>{t.category} · {fDate(t.date)}</div>
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: t.amount > 0 ? '#4ade80' : '#f87171' }}>
                  {t.amount > 0 ? '+' : ''}{fEur(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
