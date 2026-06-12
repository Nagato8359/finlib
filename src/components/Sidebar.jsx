import logo from '../logo.png';

export default function Sidebar({ T, tab, setTab, TABS }) {
  return (
    <aside className="sidebar" style={{
      width: 220, flexShrink: 0,
      background: 'linear-gradient(to bottom, #0d1117, #0a0f1a, #080e1a)',
      boxShadow: '2px 0 20px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, height: '100vh',
      zIndex: 40, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 12px 10px', flexShrink: 0 }}>
        <img src={logo} alt="Capitaly" onClick={() => setTab('accueil')} style={{ width: 200, height: 'auto', display: 'block', cursor: 'pointer' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0px 10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map(tb => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              data-tutorial={tb.id}
              onClick={() => setTab(tb.id)}
              className={active ? 'sb-item sb-active' : 'sb-item'}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 12px', borderRadius: 10,
                border: 'none',
                borderLeft: active ? `3px solid ${T.accent}` : '3px solid transparent',
                background: active ? T.accent + '1e' : 'transparent',
                color: active ? T.accent : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textAlign: 'left', width: '100%',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{tb.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{tb.label}</span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
}
