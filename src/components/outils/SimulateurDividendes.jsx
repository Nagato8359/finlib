import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts';
import { makeS, fEur } from '../../utils/constants';

const FREQ_OPTIONS = [
  { v: 'mensuel',     l: 'Mensuel',     n: 12 },
  { v: 'trimestriel', l: 'Trimestriel', n: 4 },
  { v: 'annuel',      l: 'Annuel',      n: 1 },
];

const PORTFOLIOS = [
  {
    id: 'defensif',
    icon: '🛡️',
    title: 'Portefeuille défensif',
    desc: 'Revenus stables, faible risque',
    avgYield: 3.5,
    color: '#60a5fa',
    assets: [
      { name: 'TotalEnergies',              ticker: 'TTE',  sector: 'Énergie',         country: 'France',  yield: 4.7, alloc: 20 },
      { name: 'Sanofi',                     ticker: 'SAN',  sector: 'Santé',           country: 'France',  yield: 3.8, alloc: 20 },
      { name: 'Engie',                      ticker: 'ENGI', sector: 'Utilities',       country: 'France',  yield: 8,   alloc: 15 },
      { name: 'Orange',                     ticker: 'ORA',  sector: 'Télécoms',        country: 'France',  yield: 7,   alloc: 15 },
      { name: 'BNP Paribas',                ticker: 'BNP',  sector: 'Banque',          country: 'France',  yield: 6,   alloc: 15 },
      { name: 'Amundi ETF Dividende',        ticker: 'TDIV', sector: 'ETF Dividende',   country: 'Europe',  yield: 4,   alloc: 10 },
      { name: 'iShares STOXX Europe 600',    ticker: 'EXW1', sector: 'ETF Large Cap',   country: 'Europe',  yield: 3,   alloc: 5 },
    ],
  },
  {
    id: 'equilibre',
    icon: '📈',
    title: 'Portefeuille équilibré',
    desc: 'Équilibre rendement/croissance',
    avgYield: 5,
    color: '#fbbf24',
    assets: [
      { name: 'LVMH',                                  ticker: 'MC',   sector: 'Luxe',                 country: 'France',       yield: 2,   alloc: 15 },
      { name: 'Air Liquide',                            ticker: 'AI',   sector: 'Industrie',            country: 'France',       yield: 2.5, alloc: 15 },
      { name: 'Schneider Electric',                      ticker: 'SU',   sector: 'Industrie',            country: 'France',       yield: 2.5, alloc: 15 },
      { name: 'Vinci',                                  ticker: 'DG',   sector: 'BTP / Concessions',    country: 'France',       yield: 4,   alloc: 15 },
      { name: 'Michelin',                               ticker: 'ML',   sector: 'Industrie',            country: 'France',       yield: 3.5, alloc: 10 },
      { name: 'SPDR S&P Global Dividend',                ticker: 'WDIV', sector: 'ETF Dividende Mondial', country: 'États-Unis', yield: 4.5, alloc: 10 },
      { name: 'VanEck Morningstar Dev Market Div',       ticker: 'TDIV', sector: 'ETF Dividende Mondial', country: 'États-Unis', yield: 5,   alloc: 10 },
      { name: 'Unibail-Rodamco-Westfield',               ticker: 'URW',  sector: 'REIT / Immobilier',    country: 'France',       yield: 8,   alloc: 10 },
    ],
  },
  {
    id: 'rendement',
    icon: '🚀',
    title: 'Portefeuille rendement élevé',
    desc: 'Rendement maximal, risque plus élevé',
    avgYield: 8,
    color: '#f87171',
    assets: [
      { name: 'Engie',                       ticker: 'ENGI', sector: 'Utilities',         country: 'France',     yield: 8,  alloc: 20 },
      { name: 'Orange',                      ticker: 'ORA',  sector: 'Télécoms',          country: 'France',     yield: 7,  alloc: 20 },
      { name: 'BNP Paribas',                 ticker: 'BNP',  sector: 'Banque',            country: 'France',     yield: 6,  alloc: 15 },
      { name: 'Unibail-Rodamco-Westfield',    ticker: 'URW',  sector: 'REIT / Immobilier', country: 'France',     yield: 8,  alloc: 15 },
      { name: 'Covivio',                     ticker: 'COV',  sector: 'REIT / Immobilier', country: 'France',     yield: 7,  alloc: 15 },
      { name: 'Global X SuperDividend ETF',  ticker: 'SDIV', sector: 'ETF Haut Rendement', country: 'États-Unis', yield: 10, alloc: 15 },
    ],
  },
];

const PIE_COLORS = ['#10b981', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#f472b6'];

function neededCapital(monthlyIncome, yieldPct, taxPct) {
  const annual = monthlyIncome * 12;
  if (yieldPct <= 0) return { brut: 0, net: 0 };
  const brut = annual / (yieldPct / 100);
  const net = annual / ((yieldPct / 100) * (1 - taxPct / 100));
  return { brut, net };
}

export default function SimulateurDividendes({ T }) {
  const S = makeS(T);
  const [activeTab, setActiveTab] = useState('calc');

  // ── Paramètres principaux ────────────────────────────────────────────────
  const [monthlyIncome,       setMonthlyIncome]       = useState(1000);
  const [yieldRate,           setYieldRate]           = useState(4);
  const [frequency,           setFrequency]           = useState('mensuel');
  const [taxRate,             setTaxRate]             = useState(30);
  const [reinvest,            setReinvest]            = useState(true);
  const [years,               setYears]               = useState(20);
  const [monthlyContribution, setMonthlyContribution] = useState(500);

  const needed = useMemo(() => neededCapital(monthlyIncome, yieldRate, taxRate), [monthlyIncome, yieldRate, taxRate]);

  const sim = useMemo(() => {
    const r = yieldRate / 100 / 12;
    const maxMonths = Math.max(years, 50) * 12;
    let capital = 0;
    let goalMonths = null;
    const rows = [];
    for (let m = 1; m <= maxMonths; m++) {
      capital = reinvest ? capital * (1 + r) + monthlyContribution : capital + monthlyContribution;
      if (goalMonths === null && needed.net > 0 && capital >= needed.net) goalMonths = m;
      if (m % 12 === 0 && m / 12 <= years) {
        const grossMonthlyDiv = capital * (yieldRate / 100) / 12;
        rows.push({
          year: m / 12,
          capital: Math.round(capital),
          dividendesNetMensuel: Math.round(grossMonthlyDiv * (1 - taxRate / 100)),
        });
      }
    }
    return { rows, goalMonths, finalCapital: rows[rows.length - 1]?.capital || 0 };
  }, [yieldRate, years, monthlyContribution, reinvest, needed.net, taxRate]);

  const annualNetDividends = sim.finalCapital * (yieldRate / 100) * (1 - taxRate / 100);
  const netYieldPct = yieldRate * (1 - taxRate / 100);

  const goalLabel = useMemo(() => {
    if (sim.goalMonths == null) return '> 50 ans';
    if (sim.goalMonths < 12) return `${sim.goalMonths} mois`;
    const y = Math.floor(sim.goalMonths / 12);
    const m = sim.goalMonths % 12;
    return `${y} an${y > 1 ? 's' : ''}${m ? ` ${m} mois` : ''}`;
  }, [sim.goalMonths]);

  const freqOpt = FREQ_OPTIONS.find(f => f.v === frequency) || FREQ_OPTIONS[0];
  const perPaymentNet = annualNetDividends / freqOpt.n;

  const numInputStyle = {
    width: 82, textAlign: 'right', flexShrink: 0,
    background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 8,
    padding: '4px 8px', fontSize: 13, color: T.text, fontFamily: 'inherit',
  };

  const Slider = ({ label, value, set, min, max, step, unit = '' }) => (
    <div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onInput={e => set(Number(e.target.value))}
          onChange={e => set(Number(e.target.value))}
          style={{ flex: 1, cursor: 'pointer', minWidth: 0, touchAction: 'none' }}
        />
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => set(+e.target.value)}
          onBlur={e => set(Math.min(max, Math.max(min, +e.target.value)))}
          style={numInputStyle}
        />
        {unit.trim() && <span style={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>{unit.trim()}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginTop: 2 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );

  const KpiBox = ({ icon, label, value, sub, color }) => (
    <div style={{ ...S.card, textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || T.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ color: T.textMuted, marginBottom: 4 }}>Année {label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name} : {fEur(p.value)}</div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 2 }}>{d.name}</div>
        <div style={{ color: T.textMuted }}>{d.value}% — rendement {d.yield}%</div>
      </div>
    );
  };

  const TABS_LIST = [
    { id: 'calc',          label: '🧮 Calculateur' },
    { id: 'portefeuilles', label: '📦 Exemples de portefeuilles' },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .div-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        .div-portfolio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .div-table-wrap { overflow-x: auto; }
        .div-table { width: 100%; border-collapse: collapse; min-width: 480px; }
        .div-table th { font-size: 10px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: .05em; padding: 7px 10px; text-align: right; white-space: nowrap; }
        .div-table th:first-child, .div-table th:nth-child(2) { text-align: left; }
        .div-table td { font-size: 12px; padding: 8px 10px; border-top: 1px solid ${T.cardBorder}; text-align: right; color: ${T.text}; }
        .div-table td:first-child, .div-table td:nth-child(2) { text-align: left; }
        @media (max-width: 768px) {
          .div-grid { grid-template-columns: 1fr; }
          .div-portfolio-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>💰 Simulateur Dividendes</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Calculez le capital nécessaire pour vivre de vos dividendes</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS_LIST.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ background: activeTab === tab.id ? T.accent + '1e' : T.cardBg, border: `1px solid ${activeTab === tab.id ? T.accent : T.cardBorder}`, color: activeTab === tab.id ? T.accent : T.textMuted, borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════ SECTION 1+2 — Calculateur ══════════════════════════ */}
      {activeTab === 'calc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Paramètres</h3>
            <div className="div-grid">
              <Slider label="Revenu mensuel souhaité" value={monthlyIncome}       set={setMonthlyIncome}       min={0} max={10000} step={50} unit=" €" />
              <Slider label="Rendement moyen du portefeuille" value={yieldRate}  set={setYieldRate}           min={1} max={15}    step={0.1} unit="%" />
              <Slider label="Taux d'imposition sur dividendes" value={taxRate}   set={setTaxRate}             min={0} max={50}    step={1} unit="%" />
              <Slider label="Durée d'accumulation" value={years}                 set={setYears}               min={1} max={40}    step={1} unit=" ans" />
              <Slider label="Apport mensuel" value={monthlyContribution}         set={setMonthlyContribution} min={0} max={5000}  step={50} unit=" €" />

              <div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Fréquence de versement</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FREQ_OPTIONS.map(f => (
                    <button key={f.v} onClick={() => setFrequency(f.v)}
                      style={{ background: frequency === f.v ? T.accent + '22' : T.bg2, border: `1px solid ${frequency === f.v ? T.accent : T.cardBorder}`, color: frequency === f.v ? T.accent : T.textMuted, borderRadius: 8, padding: '5px 11px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Réinvestissement des dividendes</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }].map(o => (
                    <button key={String(o.v)} onClick={() => setReinvest(o.v)}
                      style={{ background: reinvest === o.v ? T.accent + '22' : T.bg2, border: `1px solid ${reinvest === o.v ? T.accent : T.cardBorder}`, color: reinvest === o.v ? T.accent : T.textMuted, borderRadius: 8, padding: '5px 11px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.cardBorder}` }}>
              💡 Soit {fEur(perPaymentNet)} net par versement ({freqOpt.l.toLowerCase()}), sur la base du capital projeté après {years} an{years > 1 ? 's' : ''}.
            </div>
          </div>

          <div className="g4">
            <KpiBox icon="🏛️" label="Capital nécessaire" value={fEur(needed.net)} sub={`Brut : ${fEur(needed.brut)}`} color={T.accent} />
            <KpiBox icon="💸" label="Dividendes annuels nets" value={fEur(annualNetDividends)} sub={`${fEur(annualNetDividends / 12)}/mois`} color="#4ade80" />
            <KpiBox icon="⏳" label="Temps pour y arriver" value={goalLabel} sub="avec votre apport actuel" color="#60a5fa" />
            <KpiBox icon="📊" label="Rendement net" value={`${netYieldPct.toFixed(2)}%`} sub={`Brut : ${yieldRate.toFixed(1)}%`} color="#fbbf24" />
          </div>

          <div style={{ ...S.card, minWidth: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Évolution du capital et des dividendes</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sim.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(years / 10) - 1)} />
                <YAxis yAxisId="left"  tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v)} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v)} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine yAxisId="right" y={monthlyIncome} stroke="#fbbf24" strokeDasharray="4 3" label={{ value: 'Objectif', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }} />
                <Line yAxisId="left"  type="monotone" dataKey="capital"              name="Capital"                stroke={T.accent} strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="dividendesNetMensuel" name="Dividendes mensuels nets" stroke="#60a5fa" strokeWidth={2}   dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══════════════════════════ SECTION 3 — Exemples de portefeuilles ══════════════════════════ */}
      {activeTab === 'portefeuilles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PORTFOLIOS.map(p => {
            const pNeeded = neededCapital(monthlyIncome, p.avgYield, taxRate);
            const pieData = p.assets.map(a => ({ name: `${a.ticker} — ${a.name}`, value: a.alloc, yield: a.yield }));
            return (
              <div key={p.id} style={{ ...S.card }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{p.icon} {p.title}</h3>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{p.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: p.color + '22', color: p.color, padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                      Rendement moyen : {p.avgYield}%
                    </span>
                    <button onClick={() => { setYieldRate(p.avgYield); setActiveTab('calc'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 14px' }}>
                      Appliquer ce rendement
                    </button>
                  </div>
                </div>

                <div className="div-portfolio-grid">
                  <div className="div-table-wrap">
                    <table className="div-table">
                      <thead>
                        <tr>
                          <th>Actif</th><th>Ticker</th><th>Secteur</th><th>Pays</th><th>Rendement</th><th>Allocation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.assets.map(a => (
                          <tr key={a.ticker + a.name}>
                            <td>{a.name}</td>
                            <td style={{ color: T.textMuted }}>{a.ticker}</td>
                            <td style={{ color: T.textMuted }}>{a.sector}</td>
                            <td style={{ color: T.textMuted }}>{a.country}</td>
                            <td style={{ fontWeight: 600 }}>{a.yield}%</td>
                            <td style={{ fontWeight: 600 }}>{a.alloc}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ background: T.bg2, borderRadius: 10, padding: '10px 14px', marginTop: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                        Capital nécessaire avec ce rendement
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{fEur(pNeeded.net)}</div>
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>Brut : {fEur(pNeeded.brut)}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
