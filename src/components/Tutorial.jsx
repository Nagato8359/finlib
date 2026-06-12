import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    target: null,
    emoji: '✨',
    title: 'Bienvenue sur Capitaly',
    desc: "Capitaly est votre outil de gestion patrimoniale tout-en-un. Suivez vos investissements en temps réel, gérez votre budget, analysez vos performances et faites croître votre liberté financière. Ce tutoriel vous présente les fonctionnalités en 2 minutes.",
  },
  {
    target: 'accueil',
    emoji: '🏠',
    title: 'Accueil — Votre tableau de bord',
    desc: "Le graphe affiche votre patrimoine total et son évolution sur 1J, 1S, 1M, 6M, 1A ou depuis le début — le mode 1J utilise les prix intraday réels. Consultez aussi votre performance globale par catégorie, vos objectifs en cours et un aperçu de vos trophées.",
  },
  {
    target: 'patrimoine',
    emoji: '◈',
    title: 'Patrimoine — Vos investissements',
    desc: "Organisez vos actifs par enveloppe fiscale : PEA, CTO, Crypto, Immobilier. Pour chaque position, saisissez le ticker ou l'ISIN, le nombre de parts et le prix d'achat. Les cours sont mis à jour en temps réel via Yahoo Finance et CoinGecko. La projection patrimoniale simule votre trajectoire selon un rendement cible.",
  },
  {
    target: 'patrimoine',
    emoji: '🏦',
    title: 'Épargne & Cash',
    desc: "Toujours dans Patrimoine, saisissez vos comptes réglementés : Livret A, LDDS, LEP, PEL, Assurance-vie... Les plafonds légaux et les taux d'intérêt sont pré-remplis automatiquement. Suivez vos liquidités et votre santé financière globale — fonds d'urgence recommandé : 3 à 6 mois de charges.",
  },
  {
    target: 'budget',
    emoji: '📊',
    title: 'Budget — Maîtrisez vos dépenses',
    desc: "Définissez des enveloppes budgétaires mensuelles par catégorie (alimentation, transport, loisirs, santé...). Des alertes colorées vous préviennent quand vous approchez ou dépassez un budget. Créez des objectifs financiers concrets — voyage, voiture, apport immobilier — et suivez leur progression graphique mois après mois.",
  },
  {
    target: 'flux',
    emoji: '↕',
    title: 'Flux — Vos transactions',
    desc: "Enregistrez toutes vos entrées et sorties d'argent, manuellement ou en important vos relevés bancaires au format CSV. Configurez des transactions récurrentes (loyer, abonnements, salaire) pour ne rien oublier. La prévision de trésorerie projette votre solde disponible sur les prochaines semaines.",
  },
  {
    target: 'investir',
    emoji: '🚀',
    title: 'Investir — Meilleures plateformes',
    desc: "Découvrez une sélection de plateformes d'investissement : courtiers en ligne, assurances-vie, comptes d'épargne. Chaque fiche présente les avantages, les frais et un lien direct pour ouvrir un compte. Comparez facilement les offres pour choisir celle qui correspond à votre profil d'investisseur.",
  },
  {
    target: 'ia',
    emoji: '🤖',
    title: 'IA Capitaly — Votre conseiller',
    desc: "L'IA analyse automatiquement votre patrimoine et génère des insights personnalisés : diversification, allocation d'actifs, niveau de risque. Posez n'importe quelle question en langage naturel — simulation de retraite, comparaison d'ETF, optimisation fiscale. Elle connaît votre situation réelle grâce à vos données Capitaly.",
  },
  {
    target: null,
    emoji: '🏆',
    title: 'Trophées & Progression',
    desc: "Capitaly récompense vos bonnes habitudes financières avec un système de points. Gagnez des trophées en ajoutant vos actifs, en atteignant vos objectifs et en maintenant un bon taux d'épargne. Progressez à travers 5 statuts : Bronze → Argent → Or → Platine → Elite. Accédez à vos trophées depuis le menu ≡.",
  },
  {
    target: null,
    emoji: '⚙️',
    title: 'Paramètres & Profil',
    desc: "Personnalisez Capitaly via le menu ≡ en haut à droite. Choisissez votre devise d'affichage (€, $, £...), la langue (FR/EN), le thème clair/sombre et la couleur d'accent. Exportez toutes vos données en JSON ou CSV pour les sauvegarder — et importez-les pour restaurer votre historique.",
  },
  {
    target: null,
    emoji: '🎉',
    title: "C'est parti !",
    desc: "Votre patrimoine commence par votre premier actif. Rendez-vous dans Patrimoine pour ajouter vos premières positions. En cas de question, l'IA Capitaly est là pour vous guider à tout moment. Bonne route vers la liberté financière ! 🚀",
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

export default function Tutorial({ T, onDone }) {
  const [step, setStep]         = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const accent = T.accent || '#10b981';
  const current = STEPS[step];

  useEffect(() => {
    const el = getVisibleEl(current.target);

    if (!el) {
      setSpotRect(null);
      return;
    }

    // Read rect BEFORE applying transform (getBoundingClientRect doesn't reflect
    // CSS transforms until they're committed, but reading first is safest)
    const r = el.getBoundingClientRect();
    const dw = r.width  * 0.05; // half of 10% scale on each side
    const dh = r.height * 0.05;
    setSpotRect({
      top:    r.top    - dh,
      left:   r.left   - dw,
      width:  r.width  * 1.1,
      height: r.height * 1.1,
    });

    // Scale element after reading rect — React doesn't manage this property
    // so reconciliation won't override it
    el.style.transition = 'transform .35s cubic-bezier(0.34,1.56,0.64,1)';
    el.style.transform  = 'scale(1.1)';

    return () => {
      el.style.transform  = '';
      el.style.transition = '';
    };
  }, [step, current.target]); // eslint-disable-line

  const finish = useCallback(() => {
    localStorage.setItem('capitaly_tutorial_done', '1');
    onDone();
  }, [onDone]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };
  const prev = () => setStep(s => Math.max(0, s - 1));

  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  // Arrow: above the spotlight by default, below if element is near the top of screen
  const arrowBelow = spotRect ? spotRect.top < 120 : false;

  return (
    <>
      <style>{`
        @keyframes tut-glow {
          0%, 100% {
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.82),
                        0 0 0 3px ${accent},
                        0 0 18px ${accent}aa,
                        inset 0 0 16px ${accent}22;
            background: rgba(16,185,129,0.14);
          }
          50% {
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.82),
                        0 0 0 3px ${accent},
                        0 0 44px ${accent},
                        inset 0 0 24px ${accent}44;
            background: rgba(16,185,129,0.26);
          }
        }
        @keyframes tut-arrow {
          0%, 100% { transform: translateY(0);   opacity: 1;   filter: drop-shadow(0 0 6px ${accent}); }
          50%       { transform: translateY(-9px); opacity: 0.65; filter: drop-shadow(0 0 14px ${accent}); }
        }
        @keyframes tut-card-in {
          from { opacity: 0; transform: scale(.93) translateY(16px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
      `}</style>

      {/* Click blocker — blocks all interaction with the app underneath */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9985 }} />

      {/* Dark overlay when there is no spotlight target */}
      {!spotRect && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9986,
          background: 'rgba(0,0,0,0.82)', pointerEvents: 'none',
        }} />
      )}

      {/* Spotlight — green tint + 3px animated border + dark overlay via box-shadow */}
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

      {/* Bouncing arrow pointing at the highlighted element */}
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

      {/* Card — centered in viewport, above everything */}
      <div
        style={{
          position: 'fixed', inset: 0,
          zIndex: 9990,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px',
          pointerEvents: 'none',
        }}
      >
        <div
          key={step}
          style={{
            background: '#0d1425',
            border: `1px solid ${T.cardBorder || '#1f2937'}`,
            borderRadius: 24,
            padding: '26px 22px 20px',
            maxWidth: 410,
            width: '100%',
            boxShadow: '0 40px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04)',
            animation: 'tut-card-in .22s ease',
            pointerEvents: 'auto',
          }}
        >
          {/* Progress segments */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i < step
                    ? accent
                    : i === step
                    ? accent
                    : (T.cardBorder || '#1f2937'),
                  opacity: i < step ? 0.5 : 1,
                  transition: 'background .3s, opacity .3s',
                }}
              />
            ))}
          </div>

          {/* Emoji */}
          <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 8, lineHeight: 1 }}>
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
            margin: '0 0 10px', fontSize: 17, fontWeight: 800,
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
              {isLast ? 'Commencer 🚀' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
