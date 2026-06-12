export default function Navigation({ T, tab, setTab, TABS }) {
  return (
    <nav className="bot-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: T.bg, borderTop: `1px solid ${T.cardBorder}`,
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
      WebkitBackdropFilter: 'blur(12px)',
      backdropFilter: 'blur(12px)',
    }}>
      {TABS.map(t => (
        <button key={t.id} data-tutorial={t.id} onClick={() => setTab(t.id)}
          style={{
            flex: 1, border: 'none', background: 'none',
            color: tab === t.id ? (T.accent || '#10b981') : T.textMuted,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, cursor: 'pointer', fontFamily: 'inherit',
            minHeight: 56, padding: '8px 4px',
            transition: 'color .15s',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap', letterSpacing: '.02em' }}>
            {t.short || t.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
