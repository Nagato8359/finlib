import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import { makeS, fEur } from '../../utils/constants';

const TRIMESTRES_REQUIS = 172;
const VIE_ESTIMEE = 85;
const LOCATIF_YIELD = 5;

const REGIMES = [
  { key: 'salarie',       label: 'Salarié privé',  tauxPlein: 50, complRatio: 0.6 },
  { key: 'fonctionnaire', label: 'Fonctionnaire',  tauxPlein: 75, complRatio: 0 },
  { key: 'independant',   label: 'Indépendant',    tauxPlein: 50, complRatio: 0.3 },
];

// Strip a leftover emoji prefix some stored investment types carry from older form bugs.
const normType = s => (s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim().toLowerCase();

// Defined at module scope (not inside SimulateurRetraite) so their identity stays stable
// across renders — otherwise React remounts the <input> on every drag tick and the browser
// loses its native drag-tracking on the destroyed node, leaving only clicks working.
function Slider({ T, label, value, set, min, max, step, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100;
  const numInputStyle = {
    width: 82, textAlign: 'right', flexShrink: 0,
    background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 8,
    padding: '4px 8px', fontSize: 13, color: T.text, fontFamily: 'inherit',
  };
  return (
    <div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onInput={e => set(Number(e.target.value))}
          onChange={e => set(Number(e.target.value))}
          style={{
            flex: 1, minWidth: 0,
            WebkitAppearance: 'none', appearance: 'none',
            width: '100%', height: '6px', borderRadius: '3px',
            outline: 'none', cursor: 'grab', touchAction: 'pan-x', userSelect: 'none', pointerEvents: 'auto',
            background: `linear-gradient(to right, #f97316 ${pct}%, #374151 ${pct}%)`,
          }}
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
}

function KpiBox({ T, S, icon, label, value, sub, color, big }) {
  return (
    <div style={{ ...S.card, textAlign: 'center', padding: big ? '22px 16px' : '16px 12px' }}>
      <div style={{ fontSize: big ? 28 : 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: big ? 24 : 15, fontWeight: 800, color: color || T.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartTooltip({ T, active, payload, label }) {
  if (!active || !payload?.length) return null;
  const capital = payload.find(p => p.dataKey === 'capitalAccum' || p.dataKey === 'capitalDecum');
  const revenu = payload.find(p => p.dataKey === 'revenu');
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: T.textMuted, marginBottom: 4 }}>{label} ans</div>
      {capital != null && capital.value != null && <div style={{ color: capital.color }}>Capital : {fEur(capital.value)}</div>}
      {revenu != null && <div style={{ color: revenu.color }}>Revenu mensuel : {fEur(revenu.value)}</div>}
    </div>
  );
}

export default function SimulateurRetraite({ T, data, setTab }) {
  const S = makeS(T);

  const [currentAge,      setCurrentAge]      = useState(30);
  const [retirementAge,   setRetirementAge]   = useState(64);
  const [monthlySalary,   setMonthlySalary]   = useState(2500);
  const [trimestres,      setTrimestres]      = useState(40);
  const [regime,          setRegime]          = useState('salarie');
  const [extraIncomeRaw,  setExtraIncomeRaw]  = useState(0);
  const [expectedReturn,  setExpectedReturn]  = useState(4);
  const [tmi,              setTmi]             = useState(30);
  const [monthlySavings,  setMonthlySavings]  = useState(300);

  // Pré-remplit avec les loyers RealT réels dès qu'ils sont chargés, sans écraser une saisie manuelle.
  const extraIncomeTouched = useRef(false);
  const realTIncome = useMemo(() => (data?.investments || [])
    .filter(inv => normType(inv.type) === 'realt')
    .reduce((sum, inv) => sum + (parseFloat(inv.loyerMensuel) || 0), 0), [data?.investments]);
  useEffect(() => {
    if (!extraIncomeTouched.current && realTIncome > 0) setExtraIncomeRaw(Math.round(realTIncome));
  }, [realTIncome]);
  const extraIncome = extraIncomeRaw;
  const setExtraIncome = v => { extraIncomeTouched.current = true; setExtraIncomeRaw(v); };

  const regimeCfg = REGIMES.find(r => r.key === regime) || REGIMES[0];

  const pension = useMemo(() => {
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const trimestresAtRetirement = Math.min(TRIMESTRES_REQUIS, trimestres + yearsToRetirement * 4);
    const missingTrimestres = Math.max(0, TRIMESTRES_REQUIS - trimestresAtRetirement);
    const decote = missingTrimestres * 1.25;
    const tauxPension = Math.max(0, regimeCfg.tauxPlein - decote);

    const pensionBase = monthlySalary * (tauxPension / 100) * (trimestresAtRetirement / TRIMESTRES_REQUIS);
    const pensionComplementaire = pensionBase * regimeCfg.complRatio;
    const pensionTotale = pensionBase + pensionComplementaire + extraIncome;
    const gap = monthlySalary - pensionTotale;
    const tauxRemplacement = monthlySalary > 0 ? (pensionTotale / monthlySalary) * 100 : 0;

    const pensionBaseTauxPlein = monthlySalary * (regimeCfg.tauxPlein / 100);
    const pensionComplTauxPlein = pensionBaseTauxPlein * regimeCfg.complRatio;
    const pensionTotaleTauxPlein = pensionBaseTauxPlein + pensionComplTauxPlein + extraIncome;

    return {
      yearsToRetirement, trimestresAtRetirement, missingTrimestres, decote, tauxPension,
      pensionBase, pensionComplementaire, pensionTotale, gap, tauxRemplacement,
      pensionBaseTauxPlein, pensionTotaleTauxPlein,
    };
  }, [currentAge, retirementAge, monthlySalary, trimestres, extraIncome, regimeCfg]);

  const gapFill = useMemo(() => {
    const gap = pension.gap;
    const capitalNecessaire = gap > 0 ? (gap * 12) / (expectedReturn / 100) : 0;
    const dureeRetraite = Math.max(0, VIE_ESTIMEE - retirementAge);

    const nMonths = pension.yearsToRetirement * 12;
    const rMonthly = expectedReturn / 100 / 12;
    const perMonthly = gap <= 0 || nMonths <= 0 ? 0
      : (rMonthly > 0 ? capitalNecessaire * rMonthly / (Math.pow(1 + rMonthly, nMonths) - 1) : capitalNecessaire / nMonths);
    const perEconomieFiscaleAnnuelle = perMonthly * 12 * (tmi / 100);

    const capitalImmoNecessaire = gap > 0 ? (gap * 12) / (LOCATIF_YIELD / 100) : 0;

    return { capitalNecessaire, dureeRetraite, perMonthly, perEconomieFiscaleAnnuelle, capitalImmoNecessaire };
  }, [pension.gap, pension.yearsToRetirement, expectedReturn, tmi, retirementAge]);

  const chart = useMemo(() => {
    const rAnnual = expectedReturn / 100;
    const rMonthly = rAnnual / 12;
    const maxAge = Math.max(VIE_ESTIMEE, retirementAge + 1);
    let capital = 0;
    let exhaustedAge = null;
    const rows = [];
    for (let age = currentAge; age <= maxAge; age++) {
      const preCapital = capital;
      const isAccumYear = age < retirementAge;
      if (isAccumYear) {
        for (let m = 0; m < 12; m++) capital = capital * (1 + rMonthly) + monthlySavings;
      } else {
        for (let m = 0; m < 12; m++) {
          capital = capital * (1 + rMonthly);
          if (pension.gap > 0) capital = Math.max(0, capital - pension.gap);
        }
        if (capital <= 0 && exhaustedAge === null) exhaustedAge = age;
      }
      rows.push({
        age,
        capitalAccum: age <= retirementAge ? (age === retirementAge ? preCapital : capital) : null,
        capitalDecum: age >= retirementAge ? (age === retirementAge ? preCapital : capital) : null,
        revenu: isAccumYear ? monthlySalary : pension.pensionTotale + (capital > 0 ? pension.gap : 0),
      });
    }
    return { rows, exhaustedAge, maxAge };
  }, [currentAge, retirementAge, monthlySalary, monthlySavings, expectedReturn, pension.gap, pension.pensionTotale]);

  const trimestresPct = Math.min(100, (trimestres / TRIMESTRES_REQUIS) * 100);
  const trimestresRestants = Math.max(0, TRIMESTRES_REQUIS - trimestres);
  const ageTauxPlein = trimestres >= TRIMESTRES_REQUIS ? currentAge : currentAge + Math.ceil(trimestresRestants / 4);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .ret-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        .ret-gap-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 768px) {
          .ret-grid { grid-template-columns: 1fr; }
          .ret-gap-grid { grid-template-columns: 1fr; }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #f97316;
          cursor: grab;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        input[type=range]:active::-webkit-slider-thumb { cursor: grabbing; }
        input[type=range]::-moz-range-thumb {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #f97316;
          cursor: grab;
          border: 2px solid white;
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>🎯 Simulateur Retraite</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Estimez votre pension future et le capital nécessaire pour combler l'écart</p>
      </div>

      {/* ── Bannière info ── */}
      <div style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.25)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔗</span>
          <span style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>
            Pour des résultats précis, connectez-vous sur moncompte.retraite.fr et reportez vos données réelles ici (trimestres cotisés, estimation de pension).
          </span>
        </div>
        <a href="https://moncompte.retraite.fr" target="_blank" rel="noopener noreferrer"
          style={{ background: '#60a5fa', color: '#0a0f1a', borderRadius: 9, padding: '9px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Accéder à Mon Compte Retraite →
        </a>
      </div>

      {/* ══════════════════ SECTION 1 — Profil retraite ══════════════════ */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Profil retraite</h3>
        <div className="ret-grid">
          <Slider T={T} label="Âge actuel"                       value={currentAge}    set={setCurrentAge}    min={18}  max={65}   step={1}   unit=" ans" />
          <Slider T={T} label="Âge de départ souhaité"            value={retirementAge} set={setRetirementAge} min={60}  max={70}   step={1}   unit=" ans" />
          <Slider T={T} label="Salaire net mensuel actuel"        value={monthlySalary} set={setMonthlySalary} min={500} max={10000} step={50} unit=" €" />
          <Slider T={T} label="Trimestres cotisés actuellement"   value={trimestres}    set={setTrimestres}    min={0}   max={172}  step={1}   unit="" />
          <Slider T={T} label="Revenus complémentaires mensuels"  value={extraIncome}   set={setExtraIncome}   min={0}   max={5000} step={50}  unit=" €" />

          <div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Régime</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {REGIMES.map(r => (
                <button key={r.key} onClick={() => setRegime(r.key)}
                  style={{ background: regime === r.key ? T.accent + '22' : T.bg2, border: `1px solid ${regime === r.key ? T.accent : T.cardBorder}`, color: regime === r.key ? T.accent : T.textMuted, borderRadius: 8, padding: '5px 11px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.cardBorder}` }}>
          📌 Trimestres requis pour la retraite à taux plein : <strong style={{ color: T.text }}>{TRIMESTRES_REQUIS}</strong>
          {realTIncome > 0 && <> · Revenus complémentaires pré-remplis avec vos loyers RealT actuels ({fEur(realTIncome)}/mois).</>}
        </div>
      </div>

      {/* ══════════════════ SECTION 2 — Estimation pension ══════════════════ */}
      <div className="g3">
        <KpiBox T={T} S={S} icon="🏛️" label="Pension de base"          value={fEur(pension.pensionBase)} />
        <KpiBox T={T} S={S} icon="🤝" label="Pension complémentaire"   value={fEur(pension.pensionComplementaire)} />
        <KpiBox T={T} S={S} icon="🏘️" label="Revenus complémentaires" value={fEur(extraIncome)} />
      </div>

      <div className="g3">
        <KpiBox T={T} S={S} icon="💰" label="Pension totale estimée" value={fEur(pension.pensionTotale)} color={T.accent} big />
        <KpiBox T={T} S={S} icon={pension.gap > 0 ? '⚠️' : '✅'} label="Écart avec salaire actuel"
          value={pension.gap > 0 ? `-${fEur(pension.gap)}/mois` : `+${fEur(-pension.gap)}/mois`}
          color={pension.gap > 0 ? '#f87171' : '#4ade80'} big />
        <KpiBox T={T} S={S} icon="📊" label="Taux de remplacement" value={`${pension.tauxRemplacement.toFixed(0)}%`} color="#60a5fa" big />
      </div>

      {/* ══════════════════ SECTION 3 — Combler le gap ══════════════════ */}
      {pension.gap > 0 && (
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.text }}>Combler le gap</h3>
          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
            Pour maintenir votre niveau de vie, vous devrez générer <strong style={{ color: '#f87171' }}>{fEur(pension.gap)}/mois</strong> de revenus complémentaires.
          </p>

          <div style={{ marginBottom: 18, maxWidth: 360 }}>
            <Slider T={T} label="Rendement espéré" value={expectedReturn} set={setExpectedReturn} min={1} max={10} step={0.5} unit="%" />
          </div>

          <div className="g3" style={{ marginBottom: 18 }}>
            <KpiBox T={T} S={S} icon="🏦" label="Capital nécessaire" value={fEur(gapFill.capitalNecessaire)} sub={`Pour ${fEur(pension.gap)}/mois à ${expectedReturn}%`} color={T.accent} />
            <KpiBox T={T} S={S} icon="⏳" label="Durée de vie en retraite" value={`${gapFill.dureeRetraite} ans`} sub={`Jusqu'à ${VIE_ESTIMEE} ans`} color="#60a5fa" />
            <KpiBox T={T} S={S} icon="📆" label="Temps pour épargner" value={`${pension.yearsToRetirement} ans`} sub="avant le départ" color="#fbbf24" />
          </div>

          <div className="ret-gap-grid">
            <div style={{ background: T.bg2, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>💼 PER</div>
              <div style={{ marginBottom: 10, maxWidth: 280 }}>
                <Slider T={T} label="TMI (tranche marginale d'imposition)" value={tmi} set={setTmi} min={0} max={45} step={1} unit="%" />
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
                Un versement de <strong style={{ color: T.text }}>{fEur(gapFill.perMonthly)}/mois</strong> pendant {pension.yearsToRetirement} ans à {expectedReturn}% constitue le capital nécessaire.
                Économie fiscale estimée : <strong style={{ color: '#4ade80' }}>{fEur(gapFill.perEconomieFiscaleAnnuelle)}/an</strong>.
              </p>
            </div>

            <div style={{ background: T.bg2, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>📈 Dividendes</div>
              <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
                Construisez un portefeuille à dividendes pour générer {fEur(pension.gap)}/mois de revenus passifs.
              </p>
              {setTab && (
                <button onClick={() => setTab('simulateur-dividendes')} style={{ ...S.btnG, fontSize: 12, padding: '7px 14px' }}>
                  Ouvrir le Simulateur Dividendes
                </button>
              )}
            </div>

            <div style={{ background: T.bg2, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>🏘️ Immobilier locatif</div>
              <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
                Avec un rendement locatif brut de {LOCATIF_YIELD}%, il faudrait un capital immobilier d'environ <strong style={{ color: T.text }}>{fEur(gapFill.capitalImmoNecessaire)}</strong> pour générer {fEur(pension.gap)}/mois de loyers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ SECTION 4 — Graphique ══════════════════ */}
      <div style={{ ...S.card, minWidth: 0 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: T.text }}>Évolution du capital jusqu'à et pendant la retraite</h3>
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <Slider T={T} label="Apport mensuel épargne retraite" value={monthlySavings} set={setMonthlySavings} min={0} max={3000} step={50} unit=" €" />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chart.rows}>
            <defs>
              <linearGradient id="gRetAccum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} /><stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gRetDecum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.accent} stopOpacity={0.2} /><stop offset="95%" stopColor={T.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
            <XAxis dataKey="age" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil((chart.maxAge - currentAge) / 12) - 1)} />
            <YAxis yAxisId="left"  tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={60} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={60} />
            <Tooltip content={<ChartTooltip T={T} />} />
            {chart.exhaustedAge != null && (
              <ReferenceArea yAxisId="left" x1={chart.exhaustedAge} x2={chart.maxAge} fill="#f87171" fillOpacity={0.08} />
            )}
            <ReferenceLine yAxisId="left" x={retirementAge} stroke="#fbbf24" strokeDasharray="4 3" label={{ value: 'Départ retraite', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }} />
            <Area yAxisId="left" type="monotone" dataKey="capitalAccum" name="Capital (épargne)"  stroke="#4ade80" fill="url(#gRetAccum)" strokeWidth={2.5} connectNulls={false} />
            <Area yAxisId="left" type="monotone" dataKey="capitalDecum" name="Capital (retraite)" stroke={T.accent} fill="url(#gRetDecum)" strokeWidth={2.5} connectNulls={false} />
            <Line yAxisId="right" type="monotone" dataKey="revenu" name="Revenu mensuel" stroke="#60a5fa" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════════ SECTION 5 — Trimestres ══════════════════ */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Trimestres cotisés</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: T.text }}>{trimestres} / {TRIMESTRES_REQUIS} trimestres</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: trimestresPct >= 100 ? '#4ade80' : '#fb923c' }}>{Math.round(trimestresPct)}%</span>
        </div>
        <div style={{ background: T.cardBorder, borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${trimestresPct}%`, height: '100%', background: trimestresPct >= 100 ? '#4ade80' : '#fb923c', borderRadius: 6, transition: 'width .4s' }} />
        </div>

        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10, lineHeight: 1.6 }}>
          {trimestres >= TRIMESTRES_REQUIS
            ? <>Vous avez déjà atteint le taux plein.</>
            : <>Il vous reste <strong style={{ color: T.text }}>{trimestresRestants}</strong> trimestres à cotiser. Vous atteindrez le taux plein à <strong style={{ color: T.text }}>{ageTauxPlein} ans</strong> (en continuant de cotiser au même rythme).</>}
        </div>

        {pension.missingTrimestres > 0 && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.cardBorder}` }}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
              À {retirementAge} ans, il vous manquerait <strong style={{ color: '#f87171' }}>{pension.missingTrimestres}</strong> trimestres, soit une décote de <strong style={{ color: '#f87171' }}>{pension.decote.toFixed(2)}%</strong> sur le taux de pension.
            </div>
            <div className="g2">
              <KpiBox T={T} S={S} icon="📉" label="Pension avec décote"   value={fEur(pension.pensionTotale)} color="#f87171" />
              <KpiBox T={T} S={S} icon="📈" label="Pension à taux plein" value={fEur(pension.pensionTotaleTauxPlein)} color="#4ade80" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
