import { useState, useEffect, useRef } from 'react';
import logo from './logo.png';
import { requestNotifPermission } from './utils/notifications';
import { useTheme } from './hooks/useTheme';
import { useData } from './hooks/useData';
import { t } from './utils/settings';
import { LanguageProvider } from './context/LanguageContext';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Navigation from './components/Navigation';
import Accueil from './components/Accueil';
import Patrimoine from './components/Patrimoine';
import Budget from './components/Budget';
import Flux from './components/Flux';
import Investir from './components/Investir';
import IATab from './components/IATab';
import Modals from './components/Modals';
import PositionFormModal from './components/PositionFormModal';

const GlobalCSS = ({ bg, bg2, bg3, text, cardBg, cardBorder, inputBg, inputBorder, textMuted, accent = '#10b981' }) => (
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
    input:focus, select:focus, textarea:focus { outline: 2px solid ${accent}; outline-offset: 1px; }
    select option { background: ${bg3}; color: ${text}; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${cardBorder}; border-radius: 3px; }
    .fade-in { animation: fadeIn .2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
    @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
    @keyframes splashIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes splashPulse { 0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:.7;filter:brightness(1.3)} }
    @keyframes splashOut { from { opacity:1; } to { opacity:0; } }
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
    input[type=range] { accent-color: ${accent}; cursor: pointer; width: 100%; }
    /* ── Sidebar layout ─────────────────────────────────────────────────── */
    .sidebar { display: flex !important; }
    .app-main { padding-left: 220px; width: 100%; min-height: 100vh; display: flex; flex-direction: column; box-sizing: border-box; }
    .sb-item:not(.sb-active):hover { color: #10b981 !important; background: rgba(16,185,129,0.06) !important; }
    /* On desktop with sidebar: hide header logo + top-nav */
    .app-main .hdr-logo  { display: none !important; }
    .app-main .top-nav   { display: none !important; }
    @media (max-width: 768px) {
      .sidebar { display: none !important; }
      .app-main { padding-left: 0; }
      .top-nav { display: none !important; }
      .bot-nav { display: flex !important; }
      .g2 { grid-template-columns: 1fr 1fr; }
      .g3 { grid-template-columns: 1fr 1fr; }
      .g4 { grid-template-columns: 1fr 1fr; }
      .frow-3 { grid-template-columns: 1fr 1fr; }
      input, select, textarea { font-size: 16px !important; }
      /* Restore header elements on mobile */
      .app-main .hdr-logo { display: block !important; }
    }
    @media (max-width: 450px) {
      .g3, .g4 { grid-template-columns: 1fr 1fr; }
    }
  `}</style>
);

function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in'); // in → pulse → out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('pulse'), 800);
    const t2 = setTimeout(() => setPhase('out'), 1800);
    const t3 = setTimeout(onDone, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const anim = phase === 'in'
    ? 'splashIn 0.8s ease forwards'
    : phase === 'pulse'
    ? 'splashPulse 1s ease infinite'
    : 'splashOut 0.7s ease forwards';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080e1a', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: phase === 'out' ? 'splashOut 0.7s ease forwards' : 'none',
    }}>
      <style>{`
        @keyframes splashIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes splashPulse { 0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:.7;filter:brightness(1.3)} }
        @keyframes splashOut { from { opacity:1; } to { opacity:0; } }
      `}</style>
      <img
        src={logo}
        alt="Capitaly"
        style={{ height: 80, objectFit: 'contain', animation: anim }}
      />
    </div>
  );
}

export default function App() {
  const {
    darkMode, setDarkMode, T, accentKey, setAccent,
    currency, setCurrency, language, setLanguage, dateFormat, setDateFormat,
  } = useTheme();
  const data = useData();
  const [tab, setTab] = useState('accueil');
  const [showSplash, setShowSplash] = useState(true);
  const splashDoneRef = useRef(false);
  const handleSplashDone = useRef(() => {
    if (!splashDoneRef.current) { splashDoneRef.current = true; setShowSplash(false); }
  }).current;

  // Recompute TABS after each render so labels reflect current language
  const TABS = [
    { id: 'accueil',    label: t('nav_accueil'),    short: t('nav_accueil'),    icon: '🏠' },
    { id: 'patrimoine', label: t('nav_patrimoine'), short: t('nav_patrimoine'), icon: '◈'  },
    { id: 'budget',     label: t('nav_budget'),     short: t('nav_budget'),     icon: '📊' },
    { id: 'flux',       label: t('nav_flux'),       short: t('nav_flux'),       icon: '↕'  },
    { id: 'investir',   label: t('nav_investir'),   short: t('nav_investir'),   icon: '🚀' },
    { id: 'ia',         label: t('nav_ia'),         short: t('nav_ia'),         icon: '🤖' },
  ];

  // Apply preferences loaded from Supabase on login
  useEffect(() => {
    const prefs = data.loadedPreferences;
    if (!prefs) return;
    if (prefs.currency)              setCurrency(prefs.currency);
    if (prefs.language)              setLanguage(prefs.language);
    if (prefs.dateFormat)            setDateFormat(prefs.dateFormat);
    if (prefs.dark !== undefined)    setDarkMode(prefs.dark);
    if (prefs.accent)                setAccent(prefs.accent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loadedPreferences]);

  // Persist all preferences to Supabase whenever they change
  useEffect(() => {
    if (!data.user) return;
    data.savePreferences({ currency, language, dateFormat, dark: darkMode, accent: accentKey });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, language, dateFormat, darkMode, accentKey, data.user]);

  useEffect(() => {
    if (data.user || data.demoMode) requestNotifPermission();
  }, [data.user, data.demoMode]);

  if (showSplash) return <SplashScreen onDone={handleSplashDone} />;

  if (data.authLoading) {
    return (
      <>
        <style>{`body { background: #080e1a; } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
        <div style={{ minHeight: '100vh', background: '#080e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 36, animation: 'pulse 1.5s infinite' }}>💰</div>
          <div style={{ color: '#4b5563', fontSize: 14 }}>{t('loading')}</div>
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
    ia: <IATab T={T} data={data} />,
  };

  return (
    <LanguageProvider language={language}>
    <>
      <GlobalCSS {...T} accent={T.accent} />
      <div style={{ background: T.bg, display: 'flex', minHeight: '100vh' }}>
        <Sidebar T={T} tab={tab} setTab={setTab} TABS={TABS} data={data} />
        <div className="app-main">
          <Header
            T={T}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            accentKey={accentKey}
            setAccent={setAccent}
            currency={currency}
            setCurrency={setCurrency}
            language={language}
            setLanguage={setLanguage}
            dateFormat={dateFormat}
            setDateFormat={setDateFormat}
            tab={tab}
            setTab={setTab}
            TABS={TABS}
            data={data}
          />
          <main style={{ flex: 1, width: '100%', padding: '28px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
            {tabContent[tab] || tabContent.accueil}
          </main>
          <Navigation T={T} tab={tab} setTab={setTab} TABS={TABS} />
        </div>
        <Modals T={T} data={data} />
        <PositionFormModal T={T} data={data} />
      </div>
    </>
    </LanguageProvider>
  );
}
