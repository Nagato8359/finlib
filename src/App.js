import { useState, useEffect } from 'react';
import { requestNotifPermission } from './utils/notifications';
import { useTheme } from './hooks/useTheme';
import { useData } from './hooks/useData';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Accueil from './components/Accueil';
import Patrimoine from './components/Patrimoine';
import Budget from './components/Budget';
import Flux from './components/Flux';
import Investir from './components/Investir';
import Modals from './components/Modals';

const TABS = [
  { id: 'accueil',    label: 'Accueil',    short: 'Accueil',   icon: '🏠' },
  { id: 'patrimoine', label: 'Patrimoine', short: 'Patrimoine', icon: '◈' },
  { id: 'budget',     label: 'Budget',     short: 'Budget',    icon: '📊' },
  { id: 'flux',       label: 'Flux',       short: 'Flux',      icon: '↕' },
  { id: 'investir',   label: 'Investir',   short: 'Investir',  icon: '🚀' },
];

const GlobalCSS = ({ bg, bg2, bg3, text, cardBg, cardBorder, inputBg, inputBorder, textMuted }) => (
  <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${bg};
      color: ${text};
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    input, select, button, textarea { font-family: inherit; }
    input:focus, select:focus, textarea:focus { outline: 2px solid #10b981; outline-offset: 1px; }
    select option { background: ${bg3}; color: ${text}; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${cardBorder}; border-radius: 3px; }
    .fade-in { animation: fadeIn .2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .frow { display: grid; gap: 12px; margin-bottom: 14px; }
    .frow-1 { grid-template-columns: 1fr; }
    .frow-2 { grid-template-columns: 1fr 1fr; }
    .frow-3 { grid-template-columns: 1fr 1fr 1fr; }
    .top-nav { display: flex; }
    .bot-nav {
      display: none;
      align-items: stretch;
      min-height: 56px;
    }
    .pill-nav { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
    .pill-nav::-webkit-scrollbar { display: none; }
    input[type=range] { accent-color: #10b981; cursor: pointer; width: 100%; }
    @media (max-width: 768px) {
      .top-nav { display: none !important; }
      .bot-nav { display: flex !important; }
      .g2 { grid-template-columns: 1fr 1fr; }
      .g3 { grid-template-columns: 1fr 1fr; }
      .g4 { grid-template-columns: 1fr 1fr; }
      .frow-3 { grid-template-columns: 1fr 1fr; }
      input, select, textarea { font-size: 16px !important; }
    }
    @media (max-width: 450px) {
      .g3, .g4 { grid-template-columns: 1fr 1fr; }
    }
  `}</style>
);

export default function App() {
  const { darkMode, setDarkMode, T } = useTheme();
  const data = useData();
  const [tab, setTab] = useState('accueil');

  useEffect(() => {
    if (data.user || data.demoMode) requestNotifPermission();
  }, [data.user, data.demoMode]);

  if (data.authLoading) {
    return (
      <>
        <style>{`body { background: #080e1a; } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
        <div style={{ minHeight: '100vh', background: '#080e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 36, animation: 'pulse 1.5s infinite' }}>💰</div>
          <div style={{ color: '#4b5563', fontSize: 14 }}>Chargement…</div>
        </div>
      </>
    );
  }

  if (!data.user && !data.demoMode) {
    return (
      <>
        <style>{`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #080e1a; color: #f1f5f9; }`}</style>
        <AuthScreen onLogin={data.loadUserData} onDemo={data.activateDemo} />
      </>
    );
  }

  const tabContent = {
    accueil: <Accueil T={T} data={data} setTab={setTab} />,
    patrimoine: <Patrimoine T={T} data={data} />,
    budget: <Budget T={T} data={data} />,
    flux: <Flux T={T} data={data} />,
    investir: <Investir T={T} />,
  };

  return (
    <>
      <GlobalCSS {...T} />
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
        <Header
          T={T}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          tab={tab}
          setTab={setTab}
          TABS={TABS}
          data={data}
        />
        <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
          {tabContent[tab] || tabContent.accueil}
        </main>
        <Navigation T={T} tab={tab} setTab={setTab} TABS={TABS} />
        <Modals T={T} data={data} />
      </div>
    </>
  );
}
