import { useState } from 'react';
import logo from '../../logo.png';

const SLIDES = [
  {
    type:      'logo',
    title:     'Bienvenue sur Capitaly',
    subtitle:  'Votre tableau de bord patrimonial intelligent',
    desc:      'Suivez, analysez et optimisez l\'ensemble de votre patrimoine en un seul endroit.',
    btnLabel:  'Commencer la visite →',
  },
  {
    icon:  '📊',
    title: 'Votre patrimoine en un coup d\'œil',
    points: [
      'Graphique d\'évolution temporelle (1J, 7J, 1M, 3M, 1AN)',
      'Répartition par catégorie d\'actifs',
      'Performance globale en temps réel',
      'Score santé financière',
    ],
  },
  {
    icon:  '💼',
    title: 'Gérez tous vos investissements',
    points: [
      'Actions, ETF, Crypto, SCPI, RealT',
      'Matières premières, Private Equity, Art',
      'Immobilier physique et fractionné',
      'Prix mis à jour automatiquement',
    ],
  },
  {
    icon:  '🤖',
    title: 'Des outils puissants à votre service',
    points: [
      'Assistant IA pour analyser votre patrimoine',
      'Simulateur de projection long terme',
      'Calendrier des dividendes',
      'Récapitulatif fiscal & optimisation',
    ],
  },
  {
    icon:    '✅',
    isLast:  true,
    title:   'Vous êtes prêt !',
    desc:    'Commencez par ajouter vos premiers investissements.',
    btnLabel: 'Accéder à mon patrimoine',
  },
];

export default function TutorialSlides({ onDone, onSkip }) {
  const [slide, setSlide] = useState(0);
  const cur     = SLIDES[slide];
  const isLast  = slide === SLIDES.length - 1;
  const isFirst = slide === 0;

  const next = () => { if (isLast) onDone(); else setSlide(s => s + 1); };
  const prev = () => setSlide(s => s - 1);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0f14', zIndex: 9995,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px',
    }}>
      <style>{`
        @keyframes tsl-in { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes tsl-dot { from { width:8px; } to { width:24px; } }
      `}</style>

      {/* Skip button */}
      <button
        onClick={onSkip}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 10, color: 'rgba(255,255,255,.45)', padding: '6px 14px',
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Passer ✕
      </button>

      {/* Slide */}
      <div
        key={slide}
        style={{
          maxWidth: 520, width: '100%', textAlign: 'center',
          animation: 'tsl-in .3s ease',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        {cur.type === 'logo' && (
          <img
            src={logo}
            alt="Capitaly"
            style={{ width: 'min(240px,65vw)', height: 'auto', marginBottom: 28, objectFit: 'contain' }}
          />
        )}

        {cur.icon && (
          <div style={{ fontSize: 60, marginBottom: 20, lineHeight: 1 }}>{cur.icon}</div>
        )}

        <h1 style={{
          fontSize: 'clamp(20px,4vw,28px)', fontWeight: 800, color: '#f1f5f9',
          marginBottom: 10, lineHeight: 1.2,
        }}>
          {cur.title}
        </h1>

        {cur.subtitle && (
          <p style={{ fontSize: 15, color: '#60a5fa', fontWeight: 600, marginBottom: 12 }}>
            {cur.subtitle}
          </p>
        )}

        {cur.desc && (
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,.58)', lineHeight: 1.7,
            maxWidth: 400, marginBottom: 32,
          }}>
            {cur.desc}
          </p>
        )}

        {cur.points && (
          <ul style={{
            listStyle: 'none', padding: 0, marginBottom: 36,
            display: 'flex', flexDirection: 'column', gap: 8,
            textAlign: 'left', width: '100%', maxWidth: 380,
          }}>
            {cur.points.map((pt, i) => (
              <li
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 10,
                }}
              >
                <span style={{ color: '#10b981', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✓</span>
                <span style={{ color: 'rgba(255,255,255,.72)', fontSize: 13, lineHeight: 1.5 }}>{pt}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            style={{
              width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
              background: i === slide ? '#10b981' : 'rgba(255,255,255,.18)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all .3s',
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {!isFirst && (
          <button
            onClick={prev}
            style={{
              padding: '11px 20px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,.15)',
              background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← Précédent
          </button>
        )}

        {cur.isLast ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onDone}
              style={{
                padding: '13px 32px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#10b981,#059669)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Accéder à mon patrimoine
            </button>
            <button
              onClick={onSkip}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,.35)', fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
              }}
            >
              Passer le tutoriel
            </button>
          </div>
        ) : (
          <button
            onClick={next}
            style={{
              padding: '13px 28px', borderRadius: 12, border: 'none',
              background: cur.type === 'logo'
                ? 'linear-gradient(135deg,#10b981,#059669)'
                : 'linear-gradient(135deg,#3b82f6,#2563eb)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {cur.btnLabel || 'Suivant →'}
          </button>
        )}
      </div>
    </div>
  );
}
