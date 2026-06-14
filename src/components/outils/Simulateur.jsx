import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { makeS, fEur } from '../../utils/constants';

export default function Simulateur({ T }) {
  const S = makeS(T);
  const [activeTab, setActiveTab] = useState('dca');

  // ── DCA ─────────────────────────────────────────────────────────────────────
  const [dcaMonthly,  setDcaMonthly]  = useState(200);
  const [dcaInitial,  setDcaInitial]  = useState(1000);
  const [dcaRate,     setDcaRate]     = useState(8);
  const [dcaYears,    setDcaYears]    = useState(20);

  // ── Intérêts composés ────────────────────────────────────────────────────────
  const [icCapital,   setIcCapital]   = useState(10000);
  const [icRate,      setIcRate]      = useState(7);
  const [icYears,     setIcYears]     = useState(25);
  const [icFreq,      setIcFreq]      = useState(12);

  // ── Crédit ───────────────────────────────────────────────────────────────────
  const [crCapital,   setCrCapital]   = useState(200000);
  const [crRate,      setCrRate]      = useState(3.5);
  const [crYears,     setCrYears]     = useState(20);

  const dcaData = useMemo(() => {
    const r = dcaRate / 100 / 12;
    let value = dcaInitial, invested = dcaInitial;
    return Array.from({ length: dcaYears }, (_, yi) => {
      for (let m = 0; m < 12; m++) { value = value * (1 + r) + dcaMonthly; invested += dcaMonthly; }
      return { year: `An ${yi + 1}`, Valeur: Math.round(value), Versements: Math.round(invested) };
    });
  }, [dcaMonthly, dcaInitial, dcaRate, dcaYears]);

  const icData = useMemo(() => {
    const r = icRate / 100 / icFreq;
    return Array.from({ length: icYears }, (_, yi) => {
      const value = icCapital * Math.pow(1 + r, (yi + 1) * icFreq);
      return { year: `An ${yi + 1}`, Valeur: Math.round(value), Capital: icCapital };
    });
  }, [icCapital, icRate, icYears, icFreq]);

  const crData = useMemo(() => {
    const r = crRate / 100 / 12;
    const n = crYears * 12;
    const monthly = r > 0
      ? crCapital * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
      : crCapital / n;
    let remaining = crCapital, totalInterests = 0;
    const chartData = Array.from({ length: crYears }, (_, yi) => {
      for (let m = 0; m < 12; m++) {
        const interest = remaining * r;
        totalInterests += interest;
        remaining = Math.max(0, remaining - (monthly - interest));
      }
      return { year: `An ${yi + 1}`, Restant: Math.round(remaining), Remboursé: Math.round(crCapital - remaining) };
    });
    return { monthly, chartData, totalInterests };
  }, [crCapital, crRate, crYears]);

  const TABS_LIST = [
    { id: 'dca',    label: '📈 DCA' },
    { id: 'ic',     label: '✨ Intérêts composés' },
    { id: 'credit', label: '🏠 Crédit' },
  ];

  const Slider = ({ label, value, set, min, max, step, fmt = v => v, unit = '' }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>{fmt(value)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginTop: 2 }}>
        <span>{fmt(min)}{unit}</span><span>{fmt(max)}{unit}</span>
      </div>
    </div>
  );

  const KpiBox = ({ icon, label, value, color }) => (
    <div style={{ ...S.card, textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || T.text }}>{value}</div>
    </div>
  );

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ color: T.textMuted, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name} : {fEur(p.value)}</div>
        ))}
      </div>
    );
  };

  const dcaFin = dcaData[dcaData.length - 1] || {};
  const icFin  = icData[icData.length  - 1] || {};
  const { monthly: crMonthly, chartData: crChart, totalInterests: crInterests } = crData;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📈 Simulateur</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Simulez vos stratégies d'investissement</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS_LIST.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ background: activeTab === tab.id ? T.accent + '1e' : T.cardBg, border: `1px solid ${activeTab === tab.id ? T.accent : T.cardBorder}`, color: activeTab === tab.id ? T.accent : T.textMuted, borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── DCA ── */}
      {activeTab === 'dca' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Paramètres DCA</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
              <Slider label="Versement mensuel" value={dcaMonthly} set={setDcaMonthly} min={50}    max={5000}   step={50}   fmt={fEur} />
              <Slider label="Capital initial"    value={dcaInitial} set={setDcaInitial} min={0}     max={100000} step={500}  fmt={fEur} />
              <Slider label="Rendement annuel"   value={dcaRate}    set={setDcaRate}    min={1}     max={25}     step={0.5}  unit="%" />
              <Slider label="Durée"              value={dcaYears}   set={setDcaYears}   min={1}     max={40}     step={1}    unit=" ans" />
            </div>
          </div>

          <div className="g4">
            <KpiBox icon="🚀" label="Valeur finale"     value={fEur(dcaFin.Valeur,     true)} color={T.accent} />
            <KpiBox icon="💸" label="Total versé"       value={fEur(dcaFin.Versements, true)} />
            <KpiBox icon="✨" label="Intérêts générés"  value={fEur((dcaFin.Valeur || 0) - (dcaFin.Versements || 0), true)} color="#4ade80" />
            <KpiBox icon="📊" label="Multiplicateur"    value={dcaFin.Versements ? `×${((dcaFin.Valeur || 0) / dcaFin.Versements).toFixed(1)}` : '—'} color="#60a5fa" />
          </div>

          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Évolution du portefeuille</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dcaData}>
                <defs>
                  <linearGradient id="gDcaV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.2} /><stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDcaP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1} /><stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(dcaYears / 10) - 1)} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Versements" name="Versements"   stroke="#60a5fa" fill="url(#gDcaP)" strokeWidth={1.5} strokeDasharray="4 3" />
                <Area type="monotone" dataKey="Valeur"     name="Valeur totale" stroke={T.accent} fill="url(#gDcaV)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Intérêts composés ── */}
      {activeTab === 'ic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Paramètres</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
              <Slider label="Capital de départ"   value={icCapital} set={setIcCapital} min={1000} max={500000} step={1000} fmt={fEur} />
              <Slider label="Rendement annuel"    value={icRate}    set={setIcRate}    min={0.5}  max={30}     step={0.5}  unit="%" />
              <Slider label="Durée"               value={icYears}   set={setIcYears}   min={1}    max={50}     step={1}    unit=" ans" />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Fréquence de capitalisation</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: 12, l: 'Mensuelle' }, { v: 4, l: 'Trimestrielle' }, { v: 1, l: 'Annuelle' }].map(f => (
                    <button key={f.v} onClick={() => setIcFreq(f.v)}
                      style={{ background: icFreq === f.v ? T.accent + '22' : T.bg2, border: `1px solid ${icFreq === f.v ? T.accent : T.cardBorder}`, color: icFreq === f.v ? T.accent : T.textMuted, borderRadius: 8, padding: '5px 11px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="g4">
            <KpiBox icon="🚀" label="Capital final"       value={fEur(icFin.Valeur, true)} color={T.accent} />
            <KpiBox icon="💸" label="Capital de départ"   value={fEur(icCapital, true)} />
            <KpiBox icon="✨" label="Intérêts composés"   value={fEur((icFin.Valeur || 0) - icCapital, true)} color="#4ade80" />
            <KpiBox icon="📊" label="Multiplicateur"      value={`×${((icFin.Valeur || icCapital) / icCapital).toFixed(1)}`} color="#60a5fa" />
          </div>

          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Croissance du capital</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={icData}>
                <defs>
                  <linearGradient id="gIcV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.2} /><stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(icYears / 10) - 1)} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Capital" name="Capital initial"       stroke="#60a5fa" fill="rgba(96,165,250,.05)" strokeWidth={1.5} strokeDasharray="4 3" />
                <Area type="monotone" dataKey="Valeur"  name="Capital + intérêts"   stroke={T.accent} fill="url(#gIcV)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Crédit ── */}
      {activeTab === 'credit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Paramètres du crédit</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
              <Slider label="Capital emprunté" value={crCapital} set={setCrCapital} min={10000}  max={1000000} step={5000} fmt={fEur} />
              <Slider label="Taux annuel"      value={crRate}    set={setCrRate}    min={0.5}    max={10}      step={0.1}  unit="%" />
              <Slider label="Durée"            value={crYears}   set={setCrYears}   min={5}      max={30}      step={1}    unit=" ans" />
            </div>
          </div>

          <div className="g4">
            <KpiBox icon="📅" label="Mensualité"        value={`${fEur(crMonthly)}/mois`}                    color="#f87171" />
            <KpiBox icon="💸" label="Coût total"        value={fEur(crMonthly * crYears * 12, true)} />
            <KpiBox icon="📊" label="Total intérêts"    value={fEur(crInterests, true)}                      color="#fb923c" />
            <KpiBox icon="⚡" label="Taux nominal"      value={`${crRate}%`}                                 color="#60a5fa" />
          </div>

          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Amortissement du prêt</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={crChart}>
                <defs>
                  <linearGradient id="gCrR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCrP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.1} /><stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(crYears / 10) - 1)} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Remboursé" name="Capital remboursé" stroke="#4ade80" fill="url(#gCrP)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="Restant"   name="Capital restant"   stroke="#f87171" fill="url(#gCrR)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
