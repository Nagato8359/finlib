export default function Navigation({ T, tab, setTab, TABS }) {
  return (
    <nav style={{
      display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 64, background: T.bg, borderTop: `1px solid ${T.cardBorder}`,
      zIndex: 49, alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom)',
    }} className="bot-nav">
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)}
          style={{ flex: 1, border: 'none', background: 'none', color: tab === t.id ? '#10b981' : T.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', transition: 'color .15s' }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 9, fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap', letterSpacing: '.02em' }}>{t.short}</span>
        </button>
      ))}
    </nav>
  );
}
