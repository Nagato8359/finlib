import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { makeS, fEur } from '../../utils/constants';
import UpgradeWall from '../UpgradeWall';

const TRIMESTRES_REQUIS = 172;
const VIE_ESTIMEE = 85;
const MAX_MONTHS_PROJECTION = 1200;

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
  const patrimoine = payload.find(p => p.dataKey === 'patrimoine');
  const revenu = payload.find(p => p.dataKey === 'revenu');
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: T.textMuted, marginBottom: 4 }}>{label} ans</div>
      {patrimoine != null && <div style={{ color: patrimoine.color }}>Patrimoine : {fEur(patrimoine.value)}</div>}
      {revenu != null && <div style={{ color: revenu.color }}>Revenu mensuel : {fEur(revenu.value)}</div>}
    </div>
  );
}

export default function SimulateurRetraite({ T, data, setTab }) {
  const S = makeS(T);

  const [currentAge,        setCurrentAge]        = useState(30);
  const [retirementAge,     setRetirementAge]     = useState(64);
  const [monthlySalary,     setMonthlySalary]     = useState(2500);
  const [trimestres,        setTrimestres]        = useState(40);
  const [regime,            setRegime]            = useState('salarie');
  const [patrimoineRaw,     setPatrimoineRaw]     = useState(0);
  const [extraIncomeRaw,    setExtraIncomeRaw]    = useState(0);
  const [expectedReturn,    setExpectedReturn]    = useState(4);
  const [monthlySavings,    setMonthlySavings]    = useState(300);

  // Pré-remplit avec le patrimoine réel dès qu'il est chargé, sans écraser une saisie manuelle.
  const patrimoineTouched = useRef(false);
  useEffect(() => {
    if (!patrimoineTouched.current) setPatrimoineRaw(Math.round(data?.patrimoine || 0));
  }, [data?.patrimoine]);
  const patrimoineActuel = patrimoineRaw;
  const setPatrimoineActuel = v => { patrimoineTouched.current = true; setPatrimoineRaw(v); };

  // Pré-remplit avec les loyers RealT + dividendes réels dès qu'ils sont chargés, sans écraser une saisie manuelle.
  const extraIncomeTouched = useRef(false);
  const realTIncome = useMemo(() => (data?.investments || [])
    .filter(inv => normType(inv.type) === 'realt')
    .reduce((sum, inv) => sum + (parseFloat(inv.loyerMensuel) || 0), 0), [data?.investments]);
  const dividendIncome = (data?.divThisYear || 0) / 12;
  const passiveIncomeReel = realTIncome + dividendIncome;
  useEffect(() => {
    if (!extraIncomeTouched.current && passiveIncomeReel > 0) setExtraIncomeRaw(Math.round(passiveIncomeReel));
  }, [passiveIncomeReel]);
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
    const pensionRetraite = pensionBase + pensionComplementaire;
    const pensionTotale = pensionRetraite + extraIncome;
    const gap = monthlySalary - pensionTotale;
    const tauxRemplacement = monthlySalary > 0 ? (pensionTotale / monthlySalary) * 100 : 0;

    const pensionBaseTauxPlein = monthlySalary * (regimeCfg.tauxPlein / 100);
    const pensionComplTauxPlein = pensionBaseTauxPlein * regimeCfg.complRatio;
    const pensionTotaleTauxPlein = pensionBaseTauxPlein + pensionComplTauxPlein + extraIncome;

    return {
      yearsToRetirement, trimestresAtRetirement, missingTrimestres, decote, tauxPension,
      pensionBase, pensionComplementaire, pensionRetraite, pensionTotale, gap, tauxRemplacement,
      pensionTotaleTauxPlein,
    };
  }, [currentAge, retirementAge, monthlySalary, trimestres, extraIncome, regimeCfg]);

  const gapFill = useMemo(() => {
    const gap = pension.gap;
    const capitalNecessaire = gap > 0 ? (gap * 12) / (expectedReturn / 100) : 0;
    const patrimoineIncome = patrimoineActuel * (expectedReturn / 100) / 12;
    const capitalRestant = Math.max(0, capitalNecessaire - patrimoineActuel);

    const rMonthly = expectedReturn / 100 / 12;
    let capital = patrimoineActuel;
    let months = 0;
    while (capital < capitalNecessaire && months < MAX_MONTHS_PROJECTION) {
      capital = capital * (1 + rMonthly) + monthlySavings;
      months++;
    }
    const monthsToGoal = capital >= capitalNecessaire ? months : null;

    return { capitalNecessaire, patrimoineIncome, capitalRestant, monthsToGoal };
  }, [pension.gap, expectedReturn, patrimoineActuel, monthlySavings]);

  const remainingGapAfterPatrimoine = Math.max(0, pension.gap - gapFill.patrimoineIncome);

  const chart = useMemo(() => {
    const rMonthly = expectedReturn / 100 / 12;
    const maxAge = Math.max(VIE_ESTIMEE, retirementAge + 1);
    let capital = patrimoineActuel;
    const rows = [];
    for (let age = currentAge; age <= maxAge; age++) {
      const isAccumYear = age < retirementAge;
      if (isAccumYear) {
        for (let m = 0; m < 12; m++) capital = capital * (1 + rMonthly) + monthlySavings;
      } else {
        for (let m = 0; m < 12; m++) {
          capital = capital * (1 + rMonthly);
          if (pension.gap > 0) capital = Math.max(0, capital - pension.gap);
        }
      }
      rows.push({
        age,
        patrimoine: Math.round(capital),
        revenu: isAccumYear ? monthlySalary : Math.round(pension.pensionTotale + (capital > 0 ? pension.gap : 0)),
      });
    }
    return { rows, maxAge };
  }, [currentAge, retirementAge, monthlySalary, monthlySavings, expectedReturn, pension.gap, pension.pensionTotale, patrimoineActuel]);

  const monthsToGoalLabel = useMemo(() => {
    if (gapFill.capitalRestant <= 0) return 'Déjà couvert par votre patrimoine actuel';
    if (gapFill.monthsToGoal == null) return `> ${Math.round(MAX_MONTHS_PROJECTION / 12)} ans`;
    const y = Math.floor(gapFill.monthsToGoal / 12);
    const m = gapFill.monthsToGoal % 12;
    return `${y} an${y > 1 ? 's' : ''}${m ? ` ${m} mois` : ''}`;
  }, [gapFill.capitalRestant, gapFill.monthsToGoal]);

  const trimestresPct = Math.min(100, (trimestres / TRIMESTRES_REQUIS) * 100);
  const trimestresRestants = Math.max(0, TRIMESTRES_REQUIS - trimestres);
  const ageTauxPlein = trimestres >= TRIMESTRES_REQUIS ? currentAge : currentAge + Math.ceil(trimestresRestants / 4);

  const isPro = data?.isPro || false;
  if (!isPro) return <UpgradeWall T={T} featureName="Le Simulateur Retraite" />;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .ret-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        @media (max-width: 768px) { .ret-grid { grid-template-columns: 1fr; } }
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
        <a href="https://www.info-retraite.fr/portail-services/login" target="_blank" rel="noopener noreferrer"
          style={{ background: '#60a5fa', color: '#0a0f1a', borderRadius: 9, padding: '9px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Accéder à Mon Compte Retraite →
        </a>
      </div>

      {/* ══════════════════ ÉTAPE 1 — Ma situation aujourd'hui ══════════════════ */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>📍 Étape 1 — Ma situation aujourd'hui</h3>
        <div className="ret-grid">
          <Slider T={T} label="Âge actuel"                      value={currentAge}    set={setCurrentAge}      min={18} max={65}    step={1}  unit=" ans" />
          <Slider T={T} label="Salaire net mensuel actuel"       value={monthlySalary} set={setMonthlySalary}   min={500} max={10000} step={50} unit=" €" />
          <Slider T={T} label="Trimestres cotisés actuellement"  value={trimestres}    set={setTrimestres}      min={0}  max={172}   step={1}  unit="" />
          <Slider T={T} label="Patrimoine actuel"                value={patrimoineActuel} set={setPatrimoineActuel} min={0} max={1000000} step={1000} unit=" €" />
          <Slider T={T} label="Revenus passifs actuels (dividendes + loyers)" value={extraIncome} set={setExtraIncome} min={0} max={5000} step={50} unit=" €" />

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

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{trimestres} / {TRIMESTRES_REQUIS} trimestres cotisés</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: trimestresPct >= 100 ? '#4ade80' : '#fb923c' }}>{Math.round(trimestresPct)}%</span>
          </div>
          <div style={{ background: T.cardBorder, borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${trimestresPct}%`, height: '100%', background: trimestresPct >= 100 ? '#4ade80' : '#fb923c', borderRadius: 6, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
            {trimestres >= TRIMESTRES_REQUIS
              ? 'Vous avez déjà atteint le taux plein.'
              : <>Il vous reste <strong style={{ color: T.text }}>{trimestresRestants}</strong> trimestres à cotiser. Taux plein atteint à <strong style={{ color: T.text }}>{ageTauxPlein} ans</strong>.</>}
          </div>
        </div>

        <div className="g3" style={{ marginTop: 18 }}>
          <KpiBox T={T} S={S} icon="🏦" label="Patrimoine actuel" value={fEur(patrimoineActuel)} color={T.accent} />
          <KpiBox T={T} S={S} icon="🏘️" label="Revenus passifs actuels" value={fEur(extraIncome)} sub="dividendes + loyers" />
          <KpiBox T={T} S={S} icon="💼" label="Salaire net actuel" value={fEur(monthlySalary)} />
        </div>

        {passiveIncomeReel > 0 && (
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 14 }}>
            📌 Revenus passifs pré-remplis avec vos données réelles : {fEur(realTIncome)}/mois de loyers RealT + {fEur(dividendIncome)}/mois de dividendes.
          </div>
        )}
      </div>

      {/* ══════════════════ ÉTAPE 2 — Ma retraite estimée ══════════════════ */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>🎯 Étape 2 — Ma retraite estimée</h3>

        <div style={{ marginBottom: 18, maxWidth: 360 }}>
          <Slider T={T} label="Âge de départ souhaité" value={retirementAge} set={setRetirementAge} min={60} max={70} step={1} unit=" ans" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: T.bg2, borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>Pension retraite estimée (base + complémentaire)</span>
            <strong style={{ color: T.text }}>{fEur(pension.pensionRetraite)}/mois</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>Vos revenus passifs</span>
            <strong style={{ color: T.text }}>{fEur(extraIncome)}/mois</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 8, borderTop: `1px solid ${T.cardBorder}` }}>
            <span style={{ color: T.text, fontWeight: 600 }}>TOTAL à la retraite</span>
            <strong style={{ color: T.accent }}>{fEur(pension.pensionTotale)}/mois</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>Votre salaire actuel</span>
            <strong style={{ color: T.text }}>{fEur(monthlySalary)}/mois</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 8, borderTop: `1px solid ${T.cardBorder}` }}>
            <span style={{ color: T.text, fontWeight: 600 }}>{pension.gap > 0 ? 'Il vous manquera' : 'Surplus'}</span>
            <strong style={{ color: pension.gap > 0 ? '#f87171' : '#4ade80' }}>{fEur(Math.abs(pension.gap))}/mois</strong>
          </div>
        </div>

        <div className="g3">
          <KpiBox T={T} S={S} icon="💰" label="Pension totale estimée" value={fEur(pension.pensionTotale)} color={T.accent} big />
          <KpiBox T={T} S={S} icon={pension.gap > 0 ? '⚠️' : '✅'} label="Écart avec salaire actuel"
            value={pension.gap > 0 ? `-${fEur(pension.gap)}/mois` : `+${fEur(-pension.gap)}/mois`}
            color={pension.gap > 0 ? '#f87171' : '#4ade80'} big />
          <KpiBox T={T} S={S} icon="📊" label="Taux de remplacement" value={`${pension.tauxRemplacement.toFixed(0)}%`} color="#60a5fa" big />
        </div>

        {pension.gap > 0 && gapFill.patrimoineIncome > 0 && (
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.cardBorder}`, lineHeight: 1.6 }}>
            {gapFill.patrimoineIncome >= pension.gap
              ? <>✅ Votre patrimoine actuel peut déjà générer <strong style={{ color: '#4ade80' }}>{fEur(gapFill.patrimoineIncome)}/mois</strong> (à {expectedReturn}% de rendement) — de quoi couvrir tout le gap.</>
              : <>Votre patrimoine actuel peut déjà générer <strong style={{ color: T.text }}>{fEur(gapFill.patrimoineIncome)}/mois</strong> (à {expectedReturn}%). Il vous manque encore <strong style={{ color: '#f87171' }}>{fEur(remainingGapAfterPatrimoine)}/mois</strong>.</>}
          </div>
        )}

        {pension.missingTrimestres > 0 && (
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 12 }}>
            📌 Avec {pension.missingTrimestres} trimestres manquants à {retirementAge} ans (décote {pension.decote.toFixed(2)}%), votre pension à taux plein serait de {fEur(pension.pensionTotaleTauxPlein)}/mois.
          </div>
        )}
      </div>

      {/* ══════════════════ ÉTAPE 3 — Comment combler le gap ══════════════════ */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.text }}>🧩 Étape 3 — Comment combler le gap ?</h3>

        {pension.gap <= 0 ? (
          <p style={{ fontSize: 13, color: '#4ade80', marginTop: 10 }}>
            ✅ Vos revenus à la retraite couvrent déjà votre niveau de vie actuel — aucun capital supplémentaire n'est nécessaire.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '6px 0 18px' }}>
              Pour maintenir votre niveau de vie, il vous faut générer <strong style={{ color: '#f87171' }}>{fEur(pension.gap)}/mois</strong> de revenus complémentaires.
            </p>

            <div style={{ marginBottom: 18, maxWidth: 360 }}>
              <Slider T={T} label="Rendement espéré" value={expectedReturn} set={setExpectedReturn} min={1} max={10} step={0.5} unit="%" />
            </div>

            <div className="g3" style={{ marginBottom: 18 }}>
              <KpiBox T={T} S={S} icon="🏦" label="Capital supplémentaire nécessaire" value={fEur(gapFill.capitalNecessaire)} sub={`Pour ${fEur(pension.gap)}/mois à ${expectedReturn}%`} color={T.accent} />
              <KpiBox T={T} S={S} icon="✅" label="Patrimoine actuel génère déjà" value={fEur(gapFill.patrimoineIncome)} sub="par mois" color="#4ade80" />
              <KpiBox T={T} S={S} icon="📐" label="Capital encore à constituer" value={fEur(gapFill.capitalRestant)} color="#fbbf24" />
            </div>

            <div style={{ marginBottom: 18, maxWidth: 360 }}>
              <Slider T={T} label="Apport mensuel" value={monthlySavings} set={setMonthlySavings} min={0} max={3000} step={50} unit=" €" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: T.bg2, borderRadius: 12, padding: '14px 18px' }}>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Temps pour y arriver avec cet apport</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{monthsToGoalLabel}</div>
              </div>
              {setTab && (
                <button onClick={() => setTab('simulateur-dividendes')} style={{ ...S.btnG, fontSize: 12, padding: '9px 16px' }}>
                  → Simuler avec le Simulateur Dividendes
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══════════════════ Graphique ══════════════════ */}
      <div style={{ ...S.card, minWidth: 0 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Évolution du patrimoine et des revenus</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chart.rows}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
            <XAxis dataKey="age" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil((chart.maxAge - currentAge) / 12) - 1)} />
            <YAxis yAxisId="left"  tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={60} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={60} />
            <Tooltip content={<ChartTooltip T={T} />} />
            <ReferenceLine yAxisId="right" y={monthlySalary} stroke="#fbbf24" strokeDasharray="4 3" label={{ value: 'Objectif mensuel', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }} />
            <ReferenceLine yAxisId="left" x={retirementAge} stroke="#f87171" strokeWidth={1.5} label={{ value: 'Départ retraite', position: 'insideTopLeft', fill: '#f87171', fontSize: 10 }} />
            <Line yAxisId="left"  type="monotone" dataKey="patrimoine" name="Patrimoine"     stroke={T.accent} strokeWidth={2.5} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="revenu"     name="Revenu mensuel" stroke="#60a5fa" strokeWidth={2}   dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
