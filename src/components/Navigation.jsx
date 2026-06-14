import { useState } from 'react';

const OUTILS_MOBILE = [
  { id: 'investir',              label: 'Investir',        icon: '💸' },
  { id: 'projection',            label: 'Projection',      icon: '📊' },
  { id: 'calendrier-dividendes', label: 'Calendrier div.', icon: '📅' },
  { id: 'recap-fiscal',          label: 'Récap fiscal',    icon: '📋' },
  { id: 'simulateur',            label: 'Simulateur',      icon: '📈' },
  { id: 'rebalancing',           label: 'Rebalancing',     icon: '🎯' },
  { id: 'veille-marche',         label: 'Veille marché',   icon: '📰' },
  { id: 'optimisation-fiscale',  label: 'Optim. fiscale',  icon: '💰' },
];

const OUTIL_IDS = new Set(OUTILS_MOBILE.map(o => o.id));

export default function Navigation({ T, tab, setTab, TABS }) {
  const [outilsOpen, setOutilsOpen] = useState(false);
  const toolActive = OUTIL_IDS.has(tab);

  const btnStyle = (active) => ({
    flex: 1, border: 'none', background: 'none',
    color: active ? (T.accent || '#10b981') : T.textMuted,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 3, cursor: 'pointer', fontFamily: 'inherit',
    minHeight: 56, padding: '8px 4px',
    transition: 'color .15s',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  });

  const labelStyle = (active) => ({
    fontSize: 10, fontWeight: active ? 700 : 400,
    whiteSpace: 'nowrap', letterSpacing: '.02em',
  });

  return (
    <>
      <nav className="bot-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: T.bg, borderTop: `1px solid ${T.cardBorder}`,
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
      }}>
        {TABS.map(t => (
          <button key={t.id} data-tutorial={t.id}
            onClick={() => { setOutilsOpen(false); setTab(t.id); }}
            style={btnStyle(tab === t.id)}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
            <span style={labelStyle(tab === t.id)}>{t.short || t.label}</span>
          </button>
        ))}

        {/* Outils — ouvre le drawer */}
        <button
          onClick={() => setOutilsOpen(v => !v)}
          style={btnStyle(toolActive || outilsOpen)}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>🔧</span>
          <span style={labelStyle(toolActive || outilsOpen)}>Outils</span>
        </button>
      </nav>

      {/* Backdrop */}
      {outilsOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', zIndex: 98 }}
          onClick={() => setOutilsOpen(false)}
        />
      )}

      {/* Drawer — glisse au-dessus de la barre du bas */}
      <div style={{
        position: 'fixed',
        bottom: outilsOpen ? 'calc(56px + env(safe-area-inset-bottom))' : '-100%',
        left: 0, right: 0,
        background: T.bg3,
        borderTop: `1px solid ${T.cardBorder}`,
        borderRadius: '18px 18px 0 0',
        zIndex: 99,
        padding: '14px 14px 10px',
        boxShadow: '0 -8px 32px rgba(0,0,0,.4)',
        transition: 'bottom .25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Poignée */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.15)', margin: '0 auto 14px' }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10, paddingLeft: 2 }}>
          🔧 Outils
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {OUTILS_MOBILE.map(o => {
            const active = tab === o.id;
            return (
              <button key={o.id}
                onClick={() => { setTab(o.id); setOutilsOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '10px 4px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? T.accent : 'transparent'}`,
                  background: active ? T.accent + '18' : T.bg2,
                  color: active ? T.accent : T.textMuted,
                  cursor: 'pointer', fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  transition: 'all .15s',
                }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{o.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, textAlign: 'center', lineHeight: 1.3 }}>
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
