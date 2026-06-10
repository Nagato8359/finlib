import { useState, useRef, useEffect } from 'react';

export default function Header({ T, darkMode, setDarkMode, tab, setTab, TABS, data }) {
  const { user, demoMode, handleLogout } = data;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('touchstart', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('touchstart', onClickOutside);
    };
  }, [menuOpen]);

  return (
    <header className="hdr" style={{ borderBottom: `1px solid ${T.cardBorder}`, position: 'sticky', top: 0, background: T.bg, zIndex: 50, transition: 'background .2s', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '48px 1fr 48px', alignItems: 'center', height: 56, paddingLeft: 16, paddingRight: 16 }}>

        {/* Left — empty placeholder for grid balance */}
        <div />

        {/* Center — title + desktop nav */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', color: T.text, lineHeight: 1 }}>Capitaly</span>

          {/* Desktop nav */}
          <nav className="top-nav" style={{ gap: 2, marginTop: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ background: tab === t.id ? 'rgba(16,185,129,.12)' : 'transparent', border: 'none', color: tab === t.id ? '#10b981' : T.textMuted, padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right — hamburger menu */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: menuOpen ? T.cardBg : 'transparent', border: `1px solid ${menuOpen ? T.cardBorder : 'transparent'}`, borderRadius: 10, color: T.text, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', transition: 'all .15s', flexShrink: 0 }}
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '≡'}
          </button>

          {menuOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% - 4px)', right: 16, background: T.bg3, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '8px', minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', zIndex: 200 }}>

              {/* Theme toggle */}
              <button
                onClick={() => { setDarkMode(!darkMode); setMenuOpen(false); }}
                style={{ width: '100%', background: 'transparent', border: 'none', color: T.text, padding: '10px 14px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = T.cardBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 16 }}>{darkMode ? '☀️' : '🌙'}</span>
                {darkMode ? 'Mode clair' : 'Mode sombre'}
              </button>

              <div style={{ height: 1, background: T.cardBorder, margin: '4px 0' }} />

              {/* Auth actions */}
              {demoMode ? (
                <button
                  onClick={() => { data.handleLogout(); setMenuOpen(false); }}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#10b981', padding: '10px 14px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}
                  onMouseEnter={e => e.currentTarget.style.background = T.cardBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 16 }}>→</span>
                  Se connecter
                </button>
              ) : user ? (
                <>
                  <div style={{ padding: '6px 14px', fontSize: 11, color: T.textFaint, letterSpacing: '.02em' }}>{user.email}</div>
                  <button
                    onClick={() => { handleLogout(); setMenuOpen(false); }}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 16 }}>⎋</span>
                    Déconnexion
                  </button>
                </>
              ) : null}

              {demoMode && (
                <>
                  <div style={{ height: 1, background: T.cardBorder, margin: '4px 0' }} />
                  <div style={{ padding: '6px 14px', fontSize: 11, color: '#fb923c', fontWeight: 700, letterSpacing: '.05em' }}>MODE DÉMO</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
