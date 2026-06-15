import { useState, useEffect, useCallback, useRef } from 'react';

const STEPS = [
  {
    page:   'accueil',
    target: 'accueil',
    emoji:  '📊',
    title:  'Votre évolution patrimoniale',
    desc:   'Le graphe affiche votre patrimoine total et son évolution sur 1J, 7J, 1M, 3M ou 1AN. Changez la période pour suivre vos performances dans le temps.',
  },
  {
    page:   'accueil',
    target: null,
    emoji:  '🥧',
    title:  'Répartition du patrimoine',
    desc:   'Visualisez la répartition de vos actifs par catégorie : investissements, épargne, immobilier. Identifiez vos déséquilibres en un coup d\'œil.',
  },
  {
    page:   'accueil',
    target: null,
    emoji:  '🏥',
    title:  'Score & Indicateurs clés',
    desc:   'Votre score de santé financière analyse votre diversification, votre taux d\'épargne, votre fonds d\'urgence et vos performances globales.',
  },
  {
    page:   'patrimoine',
    target: 'pat-add',
    emoji:  '➕',
    title:  'Ajouter un investissement',
    desc:   'Ce bouton vous permet d\'ajouter tous vos actifs : actions, ETF, crypto, SCPI, immobilier, or, Private Equity... Recherchez par ticker, ISIN ou nom.',
  },
  {
    page:   'patrimoine',
    target: 'patrimoine',
    emoji:  '🏛️',
    title:  'Vos enveloppes fiscales',
    desc:   'Organisez vos actifs par enveloppe fiscale (PEA, CTO, Assurance-vie, Crypto...). Cliquez sur une enveloppe pour voir le détail de vos positions.',
  },
  {
    page:   'patrimoine',
    target: null,
    emoji:  '📈',
    title:  'Positions en temps réel',
    desc:   'Pour chaque position, saisissez le ticker, le nombre de parts et le prix d\'achat. Les cours sont mis à jour automatiquement via Yahoo Finance et CoinGecko.',
  },
  {
    page:   'patrimoine',
    target: null,
    emoji:  '🏦',
    title:  'Épargne & Liquidités',
    desc:   'Suivez vos livrets, comptes courants et liquidités disponibles. Les plafonds légaux (Livret A, LDDS, LEP, PEL) et les taux d\'intérêt sont pré-remplis automatiquement.',
  },
  {
    page:   'patrimoine',
    target: null,
    emoji:  '📦',
    title:  'Patrimoine matériel',
    desc:   'Voiture, collection, high-tech, articles en vente sur Vinted ou eBay... Enregistrez la valeur de tous vos biens physiques et suivez leur valorisation.',
  },
  {
    page:   'budget',
    target: 'budget',
    emoji:  '📊',
    title:  'Budgets mensuels',
    desc:   'Définissez des enveloppes budgétaires par catégorie. Des alertes colorées vous préviennent quand vous approchez ou dépassez un budget. Créez aussi des objectifs financiers.',
  },
  {
    page:   'flux',
    target: 'flux',
    emoji:  '↕',
    title:  'Vos transactions',
    desc:   'Enregistrez vos entrées et sorties d\'argent, manuellement ou en important vos relevés CSV. Configurez des transactions récurrentes (loyer, abonnements, salaire).',
  },
  {
    page:   'ia',
    target: 'ia',
    emoji:  '🤖',
    title:  'Assistant IA',
    desc:   'Posez toutes vos questions sur votre patrimoine. L\'IA analyse vos données en temps réel : diversification, optimisation fiscale, simulation de retraite, comparaison d\'ETF.',
  },
  {
    page:   'projection',
    target: null,
    emoji:  '📉',
    title:  'Projection patrimoniale',
    desc:   'Simulez l\'évolution de votre patrimoine sur 5, 10, 20 ou 30 ans selon votre rendement cible et votre épargne mensuelle. Visualisez l\'effet des intérêts composés.',
  },
  {
    page:   'calendrier-dividendes',
    target: null,
    emoji:  '📅',
    title:  'Calendrier des dividendes',
    desc:   'Anticipez vos revenus passifs : dividendes actions, loyers RealT, rendements SCPI. Visualisez vos flux entrants mois par mois pour l\'année en cours.',
  },
  {
    page:   'simulateur',
    target: null,
    emoji:  '🧮',
    title:  'Simulateur DCA & Crédit',
    desc:   'Simulez une stratégie DCA (Dollar Cost Averaging), des intérêts composés ou le remboursement anticipé d\'un crédit. Comparez différents scénarios d\'investissement.',
  },
  {
    page:   null,
    target: null,
    emoji:  '🎉',
    title:  'Tutoriel terminé !',
    desc:   'Vous maîtrisez maintenant Capitaly ! Retrouvez ce tutoriel à tout moment via le menu ≡ en haut à droite. Bonne route vers votre liberté financière ! 🚀',
  },
];

const PAD = 12;

function getVisibleEl(target) {
  if (!target) return null;
  const els = document.querySelectorAll(`[data-tutorial="${target}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export default function TutorialTooltips({ T, setTab, onDone }) {
  const [step, setStep]         = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const accent  = T.accent || '#10b981';
  const current = STEPS[step];
  const prevPage = useRef(null);

  useEffect(() => {
    const { page, target } = current;

    // Navigate to the step's page if needed
    if (page && setTab) setTab(page);

    // Delay slightly so the page has time to render before querying DOM
    const delay = page !== prevPage.current ? 200 : 50;
    prevPage.current = page;

    const timer = setTimeout(() => {
      const el = getVisibleEl(target);

      if (!el) {
        setSpotRect(null);
        return;
      }

      const r = el.getBoundingClientRect();
      const dw = r.width  * 0.05;
      const dh = r.height * 0.05;
      setSpotRect({
        top:    r.top    - dh,
        left:   r.left   - dw,
        width:  r.width  * 1.1,
        height: r.height * 1.1,
      });

      el.style.transition = 'transform .35s cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform  = 'scale(1.1)';

      return () => {
        el.style.transform  = '';
        el.style.transition = '';
      };
    }, delay);

    return () => {
      clearTimeout(timer);
      // Reset any previously scaled element
      const el = getVisibleEl(target);
      if (el) { el.style.transform = ''; el.style.transition = ''; }
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  const next = () => { if (step < STEPS.length - 1) setStep(s => s + 1); else finish(); };
  const prev = () => setStep(s => Math.max(0, s - 1));

  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const arrowBelow = spotRect ? spotRect.top < 120 : false;

  return (
    <>
      <style>{`
        @keyframes tut-glow {
          0%,100% {
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.82),
                        0 0 0 3px ${accent},
                        0 0 18px ${accent}aa,
                        inset 0 0 16px ${accent}22;
            background: ${accent}22;
          }
          50% {
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.82),
                        0 0 0 3px ${accent},
                        0 0 44px ${accent},
                        inset 0 0 24px ${accent}44;
            background: ${accent}38;
          }
        }
        @keyframes tut-arrow {
          0%,100% { transform:translateY(0);   opacity:1;    filter:drop-shadow(0 0 6px ${accent}); }
          50%      { transform:translateY(-9px); opacity:0.65; filter:drop-shadow(0 0 14px ${accent}); }
        }
        @keyframes tut-card-in {
          from { opacity:0; transform:scale(.93) translateY(16px); }
          to   { opacity:1; transform:scale(1)   translateY(0); }
        }
      `}</style>

      {/* Click blocker */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9985 }} />

      {/* Dark overlay (no spotlight) */}
      {!spotRect && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9986,
          background: 'rgba(0,0,0,0.82)', pointerEvents: 'none',
        }} />
      )}

      {/* Spotlight */}
      {spotRect && (
        <div
          style={{
            position: 'fixed',
            top:    spotRect.top    - PAD,
            left:   spotRect.left   - PAD,
            width:  spotRect.width  + PAD * 2,
            height: spotRect.height + PAD * 2,
            borderRadius: 16,
            zIndex: 9986,
            pointerEvents: 'none',
            animation: 'tut-glow 1.6s ease-in-out infinite',
          }}
        />
      )}

      {/* Bouncing arrow */}
      {spotRect && (
        <div
          style={{
            position: 'fixed',
            top:  arrowBelow
              ? spotRect.top  + spotRect.height + PAD + 8
              : spotRect.top  - PAD - 44,
            left: spotRect.left + spotRect.width / 2 - 12,
            fontSize: 22,
            color: accent,
            zIndex: 9987,
            pointerEvents: 'none',
            animation: 'tut-arrow .7s ease-in-out infinite',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {arrowBelow ? '▲' : '▼'}
        </div>
      )}

      {/* Card */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px', pointerEvents: 'none',
        }}
      >
        <div
          key={step}
          style={{
            background: '#0d1425',
            border: `1px solid ${T.cardBorder || '#1f2937'}`,
            borderRadius: 24,
            padding: '26px 22px 20px',
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 40px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04)',
            animation: 'tut-card-in .22s ease',
            pointerEvents: 'auto',
          }}
        >
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= step ? accent : (T.cardBorder || '#1f2937'),
                  opacity: i < step ? 0.45 : 1,
                  transition: 'background .3s, opacity .3s',
                }}
              />
            ))}
          </div>

          {/* Emoji */}
          <div style={{ fontSize: 38, textAlign: 'center', marginBottom: 6, lineHeight: 1 }}>
            {current.emoji}
          </div>

          {/* Step counter */}
          <div style={{
            textAlign: 'center', fontSize: 10,
            color: T.textFaint || '#4b5563',
            marginBottom: 5, fontWeight: 700,
            letterSpacing: '.1em', textTransform: 'uppercase',
          }}>
            Étape {step + 1} / {STEPS.length}
          </div>

          {/* Title */}
          <h2 style={{
            margin: '0 0 10px', fontSize: 16, fontWeight: 800,
            color: T.text || '#f1f5f9', textAlign: 'center', lineHeight: 1.3,
          }}>
            {current.title}
          </h2>

          {/* Description */}
          <p style={{
            margin: '0 0 20px', fontSize: 13, color: T.textMuted || '#9ca3af',
            lineHeight: 1.7, textAlign: 'center',
          }}>
            {current.desc}
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={prev}
              disabled={isFirst}
              style={{
                padding: '9px 12px', borderRadius: 11,
                border: `1px solid ${T.cardBorder || '#1f2937'}`,
                background: 'transparent',
                color: isFirst ? 'transparent' : (T.textMuted || '#9ca3af'),
                fontSize: 12, fontWeight: 600,
                cursor: isFirst ? 'default' : 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
                pointerEvents: isFirst ? 'none' : 'auto',
              }}
            >
              ← Précédent
            </button>

            <button
              onClick={finish}
              style={{
                padding: '9px 6px', borderRadius: 11, border: 'none',
                background: 'transparent', color: T.textFaint || '#6b7280',
                fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              Passer
            </button>

            <button
              onClick={next}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 11, border: 'none',
                background: accent, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'opacity .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {isLast ? 'Terminer 🚀' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
