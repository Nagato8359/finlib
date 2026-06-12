import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    id: 'welcome',
    target: null,
    emoji: '✨',
    title: 'Bienvenue sur Capitaly',
    desc: 'Votre patrimoine, en clair. Suivez, analysez et faites croître votre richesse.',
  },
  {
    id: 'accueil',
    target: 'accueil',
    emoji: '🏠',
    title: 'Accueil',
    desc: "Voici votre tableau de bord. Patrimoine total, performance et objectifs en un coup d'œil.",
  },
  {
    id: 'patrimoine',
    target: 'patrimoine',
    emoji: '◈',
    title: 'Patrimoine',
    desc: "Ajoutez vos investissements (PEA, crypto, ETF...), votre épargne et vos biens matériels.",
  },
  {
    id: 'budget',
    target: 'budget',
    emoji: '📊',
    title: 'Budget',
    desc: "Définissez vos budgets mensuels et suivez vos objectifs financiers.",
  },
  {
    id: 'flux',
    target: 'flux',
    emoji: '↕',
    title: 'Flux',
    desc: "Enregistrez toutes vos entrées et sorties d'argent. Importez vos relevés bancaires CSV.",
  },
  {
    id: 'investir',
    target: 'investir',
    emoji: '🚀',
    title: 'Investir',
    desc: "Découvrez les meilleures plateformes d'investissement sélectionnées pour vous.",
  },
  {
    id: 'ia',
    target: 'ia',
    emoji: '🤖',
    title: 'IA Capitaly',
    desc: "Votre conseiller financier personnel. Posez vos questions, obtenez des analyses personnalisées.",
  },
  {
    id: 'done',
    target: null,
    emoji: '🎉',
    title: "C'est parti !",
    desc: "Commencez par ajouter votre premier actif dans Patrimoine. Bonne route vers la liberté financière !",
  },
];

function findVisibleRect(target) {
  if (!target) return null;
  const els = document.querySelectorAll(`[data-tutorial="${target}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

const PAD = 8;

export default function Tutorial({ T, onDone }) {
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const accent = T.accent || '#10b981';
  const current = STEPS[step];

  useEffect(() => {
    setSpotRect(findVisibleRect(current.target));
  }, [step, current.target]);

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
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <style>{`
        @keyframes tut-glow {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px ${accent}, 0 0 14px ${accent}88; }
          50%       { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px ${accent}, 0 0 30px ${accent}; }
        }
        @keyframes tut-card-in {
          from { opacity: 0; transform: scale(.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
      `}</style>

      {/* Click blocker — prevents interaction with app underneath */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9985 }} />

      {/* Flat overlay when no spotlight */}
      {!spotRect && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9986, background: 'rgba(0,0,0,0.78)', pointerEvents: 'none' }} />
      )}

      {/* Spotlight (box-shadow creates the overlay + glow) */}
      {spotRect && (
        <div
          style={{
            position: 'fixed',
            top:    spotRect.top    - PAD,
            left:   spotRect.left   - PAD,
            width:  spotRect.width  + PAD * 2,
            height: spotRect.height + PAD * 2,
            borderRadius: 14,
            zIndex: 9986,
            pointerEvents: 'none',
            animation: 'tut-glow 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Card — centered in viewport */}
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
            background: '#0f172a',
            border: `1px solid ${T.cardBorder || '#1f2937'}`,
            borderRadius: 24,
            padding: '28px 24px 22px',
            maxWidth: 380,
            width: '100%',
            boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)',
            animation: 'tut-card-in .22s ease',
            pointerEvents: 'auto',
          }}
        >
          {/* Progress segments */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 22 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= step ? accent : (T.cardBorder || '#1f2937'),
                  transition: 'background .3s',
                }}
              />
            ))}
          </div>

          {/* Emoji illustration */}
          <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 12, lineHeight: 1 }}>
            {current.emoji}
          </div>

          {/* Step counter */}
          <div style={{ textAlign: 'center', fontSize: 10, color: T.textFaint || '#4b5563', marginBottom: 6, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Étape {step + 1} / {STEPS.length}
          </div>

          {/* Title */}
          <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 800, color: T.text || '#f1f5f9', textAlign: 'center', lineHeight: 1.25 }}>
            {current.title}
          </h2>

          {/* Description */}
          <p style={{ margin: '0 0 24px', fontSize: 13.5, color: T.textMuted || '#9ca3af', lineHeight: 1.65, textAlign: 'center' }}>
            {current.desc}
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={prev}
              disabled={isFirst}
              style={{
                padding: '9px 13px', borderRadius: 11,
                border: `1px solid ${T.cardBorder || '#1f2937'}`,
                background: 'transparent',
                color: isFirst ? 'transparent' : (T.textMuted || '#9ca3af'),
                fontSize: 13, fontWeight: 600,
                cursor: isFirst ? 'default' : 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0, pointerEvents: isFirst ? 'none' : 'auto',
              }}
            >
              ← Précédent
            </button>

            <button
              onClick={finish}
              style={{
                padding: '9px 8px', borderRadius: 11, border: 'none',
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
