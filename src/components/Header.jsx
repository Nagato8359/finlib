import { makeS } from '../utils/constants';

export default function Header({ T, darkMode, setDarkMode, tab, setTab, TABS, data }) {
  const S = makeS(T);
  const { user, demoMode, handleLogout, alerts } = data;

  return (
    <header className="hdr" style={{ borderBottom: `1px solid ${T.cardBorder}`, position: 'sticky', top: 0, background: T.bg, zIndex: 50, transition: 'background .2s' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💰</div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', color: T.text }}>CashTrack</span>
        </div>

        {/* Desktop nav */}
        <nav className="top-nav" style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: tab === t.id ? 'rgba(16,185,129,.12)' : 'transparent', border: 'none', color: tab === t.id ? '#10b981' : T.textMuted, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 12 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {alerts.length > 0 && (
            <div style={{ background: 'rgba(251,146,60,.12)', color: '#fb923c', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
              ⚠ {alerts.length}
            </div>
          )}

          {/* Dark / Light toggle */}
          <button onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            style={{ ...S.btnS, padding: '6px 12px', fontSize: 15, lineHeight: 1, borderRadius: 10 }}>
            {darkMode ? '☀️' : '🌙'}
          </button>

          {demoMode ? (
            <>
              <span style={{ fontSize: 10, background: 'rgba(251,146,60,.15)', color: '#fb923c', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>DÉMO</span>
              <button onClick={() => { data.setDemoMode && data.handleLogout(); }}
                style={{ ...S.btnG, fontSize: 12, padding: '6px 14px' }}>
                Se connecter →
              </button>
            </>
          ) : user ? (
            <>
              <div style={{ textAlign: 'right', display: 'none' }} className="hdr-email">
                <div style={{ fontSize: 11, color: T.textFaint }}>{user.email}</div>
              </div>
              <button onClick={handleLogout} style={{ ...S.btnS, fontSize: 12, padding: '6px 14px' }}>⎋ Déco</button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
