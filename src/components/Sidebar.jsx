import { useState } from 'react';
import logo from '../logo.png';

const OUTILS = [
  { id: 'investir',             label: 'Investir',              icon: '💸' },
  { id: 'projection',           label: 'Projection',            icon: '📊' },
  { id: 'calendrier-dividendes',label: 'Calendrier dividendes', icon: '📅' },
  { id: 'recap-fiscal',         label: 'Récap fiscal',          icon: '📋' },
  { id: 'simulateur',           label: 'Simulateur',            icon: '📈' },
  { id: 'simulateur-dividendes',label: 'Simulateur Dividendes', icon: '💰' },
  { id: 'rebalancing',          label: 'Rebalancing',           icon: '🎯' },
  { id: 'veille-marche',        label: 'Veille marché',         icon: '📰' },
  { id: 'optimisation-fiscale', label: 'Optimisation fiscale',  icon: '💰' },
];

const OUTIL_IDS = new Set(OUTILS.map(o => o.id));

export default function Sidebar({ T, tab, setTab, TABS }) {
  const [toolsOpen, setToolsOpen] = useState(() => OUTIL_IDS.has(tab));

  const toolActive = OUTIL_IDS.has(tab);

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

        {/* Séparateur */}
        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '6px 4px' }} />

        {/* Outils — parent */}
        <button
          onClick={() => setToolsOpen(v => !v)}
          className="sb-item"
          style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '9px 12px', borderRadius: 10,
            border: 'none',
            borderLeft: toolActive ? `3px solid ${T.accent}` : '3px solid transparent',
            background: toolActive ? T.accent + '1e' : 'transparent',
            color: toolActive ? T.accent : 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: toolActive ? 600 : 400,
            textAlign: 'left', width: '100%',
            transition: 'all .15s',
          }}
        >
          <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>🔧</span>
          <span style={{ whiteSpace: 'nowrap', flex: 1 }}>Outils</span>
          <span style={{ fontSize: 10, opacity: 0.5, transition: 'transform .2s', display: 'inline-block', transform: toolsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        </button>

        {/* Outils — sous-menu */}
        {toolsOpen && (
          <div style={{
            marginLeft: 14,
            borderLeft: '2px solid rgba(255,255,255,.07)',
            paddingLeft: 8,
            display: 'flex', flexDirection: 'column', gap: 1,
            marginTop: 1, marginBottom: 2,
          }}>
            {OUTILS.map(o => {
              const active = tab === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setTab(o.id)}
                  className={active ? 'sb-item sb-active' : 'sb-item'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8,
                    border: 'none',
                    borderLeft: active ? `2px solid ${T.accent}` : '2px solid transparent',
                    background: active ? T.accent + '18' : 'transparent',
                    color: active ? T.accent : 'rgba(255,255,255,0.42)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    textAlign: 'left', width: '100%',
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{o.icon}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
