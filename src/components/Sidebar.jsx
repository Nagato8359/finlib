import logo from '../logo.png';


function getInitials(email, displayName) {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export default function Sidebar({ T, tab, setTab, TABS, data }) {
  const email = data.user?.email || '';
  const displayName = typeof window !== 'undefined' ? (localStorage.getItem('ct_displayname') || '') : '';
  const initials = getInitials(email, displayName);

  return (
    <aside className="sidebar" style={{
      width: 220, flexShrink: 0,
      background: '#0d1117',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, height: '100vh',
      zIndex: 40, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <img src={logo} alt="Capitaly" style={{ height: 36, objectFit: 'contain', display: 'block' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map(tb => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={active ? 'sb-item sb-active' : 'sb-item'}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 12px', borderRadius: 10,
                border: 'none',
                borderLeft: active ? '3px solid #10b981' : '3px solid transparent',
                background: active ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: active ? '#10b981' : 'rgba(255,255,255,0.5)',
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

      {/* User */}
      <div style={{
        padding: '14px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#10b981', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          {displayName && (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email || (data.demoMode ? 'Mode démo' : '')}
          </div>
        </div>
      </div>
    </aside>
  );
}
