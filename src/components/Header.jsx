import { useState, useRef, useEffect, useMemo } from 'react';
import logo from '../logo.png';
import { ACCENT_OPTIONS } from '../hooks/useTheme';
import { computeTrophies } from '../utils/trophies';
import { requestNotifPermission } from '../utils/notifications';
import { useTranslation } from '../hooks/useTranslation';
import ProfilePage from './ProfilePage';
import TrophiesPage from './TrophiesPage';

const CURRENCIES   = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
const DATE_FORMATS = [
  { key: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
  { key: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
  { key: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
];
const getInitials = (name, email) => {
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (!email) return '?';
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
};

export default function Header({
  T, darkMode, setDarkMode, accentKey, setAccent,
  currency, setCurrency, language, setLanguage, dateFormat, setDateFormat,
  tab, setTab, TABS, data, onStartTutorial,
}) {
  const { t } = useTranslation();
  const { user, demoMode, handleLogout, exportCSV, exportDataJSON, importJSON, deleteAccount, profiles, activeProfileId, switchProfile, addProfile } = data;

  const [menuOpen, setMenuOpen]           = useState(false);
  const [profilePage, setProfilePage]     = useState(false);
  const [trophiesPage, setTrophiesPage]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');
  const [displayName, setDisplayName]     = useState(() => localStorage.getItem('ct_displayname') || '');
  const [notifEnabled, setNotifEnabled]   = useState(() => localStorage.getItem('ct_notif') !== '0');
  const [legalModal, setLegalModal]       = useState(null); // 'mentions' | 'privacy' | 'cgu'
  const [addProfileModal, setAddProfileModal] = useState(false);
  const [addProfileLabel, setAddProfileLabel] = useState('');
  const [addProfileLoading, setAddProfileLoading] = useState(false);

  const menuRef     = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => { setMenuOpen(false); setProfilePage(false); setTrophiesPage(false); setDeleteConfirm(false); setImportFeedback(''); };

  const handleNotif = async () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem('ct_notif', next ? '1' : '0');
    if (next) await requestNotifPermission();
  };

  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importJSON(file);
      setImportFeedback(t('menu_import_ok'));
      setTimeout(() => setImportFeedback(''), 3000);
    } catch {
      setImportFeedback(t('menu_import_err'));
      setTimeout(() => setImportFeedback(''), 3000);
    }
    e.target.value = '';
  };

  const handleAddProfile = async () => {
    if (!addProfileLabel.trim() || addProfileLoading) return;
    setAddProfileLoading(true);
    await addProfile(addProfileLabel.trim());
    setAddProfileLoading(false);
    setAddProfileLabel('');
    setAddProfileModal(false);
  };

  const accent   = T.accent || '#10b981';
  const email    = user?.email || '';
  const initials = getInitials(displayName, email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { status, totalPoints, unlockedCount } = useMemo(() => computeTrophies(data), [
    data.patrimoine, data.investments, data.invLiveValue, data.income, data.savingsRate,
    data.transactions, data.budgets, data.goals, data.soldHistory,
    data.score, data.user,
  ]);

  // ── Shared sub-components ──────────────────────────────────────────────────
  const Divider = () => <div style={{ height: 1, background: T.cardBorder, margin: '4px 8px' }} />;

  const SLabel = ({ children }) => (
    <div style={{ padding: '7px 12px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textFaint }}>
      {children}
    </div>
  );

  const MBtn = ({ icon, label, onClick, danger, right, muted }) => (
    <button
      onClick={onClick}
      style={{ width: '100%', background: 'transparent', border: 'none', color: danger ? '#f87171' : muted ? T.textMuted : T.text, padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .1s', textAlign: 'left' }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(248,113,113,.08)' : T.cardBg}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 14, flexShrink: 0, width: 18, textAlign: 'center', lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1, lineHeight: 1.3 }}>{label}</span>
      {right && <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 500 }}>{right}</span>}
    </button>
  );

  const MSelect = ({ icon, label, value, options, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 8 }}>
      <span style={{ fontSize: 14, flexShrink: 0, width: 18, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: T.text }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 6, color: T.text, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
      >
        {options.map(o => (
          <option key={o.key || o} value={o.key || o}>{o.label || o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <>
    <style>{`
      .header-logo { height: 44px; }
      .hdr-profile-info { display: flex; flex-direction: column; }
      @media (max-width: 768px) {
        .header-logo { height: 38px; }
        .hdr-profile-info { display: none !important; }
        .hdr-menu-dropdown {
          position: fixed !important;
          top: 60px !important;
          right: 8px !important;
          left: 8px !important;
          bottom: 70px !important;
          max-height: calc(100dvh - 160px) !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          background: #111827 !important;
          max-width: calc(100vw - 16px) !important;
          min-width: unset !important;
        }
      }
    `}</style>
    <header className="hdr" style={{ borderBottom: `1px solid ${T.cardBorder}`, position: 'sticky', top: 0, background: T.bg, zIndex: 50, transition: 'background .2s', paddingTop: 'env(safe-area-inset-top)' }}>
      {menuOpen && (
        <div onClick={closeMenu} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
      )}
      <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56, paddingLeft: 16, paddingRight: 16 }}>

        {/* Left — placeholder (mirrors profile block to keep nav centered) */}
        <div style={{ width: 48, flexShrink: 0 }} />

        {/* Center — title + desktop nav */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <img src={logo} alt="Capitaly" className="header-logo hdr-logo" style={{ objectFit: 'contain', display: 'block' }} />
          <nav className="top-nav" style={{ gap: 2, marginTop: 2 }}>
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ background: tab === tb.id ? accent + '1f' : 'transparent', border: 'none', color: tab === tb.id ? accent : T.textMuted, padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: tab === tb.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12 }}>{tb.icon}</span>{tb.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right — profile block */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginLeft: 'auto' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
            style={{ background: menuOpen ? T.cardBg : 'transparent', border: `1px solid ${menuOpen ? T.cardBorder : 'transparent'}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 4px 4px', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.cardBg; e.currentTarget.style.borderColor = T.cardBorder; }}
            onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent + '28', border: `2px solid ${menuOpen ? accent : accent + '55'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0, letterSpacing: '-.02em', lineHeight: 1 }}>
              {demoMode ? 'D' : initials}
            </div>
            <div className="hdr-profile-info">
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                {displayName || (demoMode ? 'Mode démo' : email ? email.split('@')[0] : '—')}
              </div>
              {!demoMode && email && (
                <div style={{ fontSize: 10, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {email}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <span style={{ fontSize: 11, lineHeight: 1 }}>{status.icon}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{status.label}</span>
                <span style={{ fontSize: 9, color: T.textFaint }}>· {totalPoints} pts · {unlockedCount} 🏆</span>
              </div>
            </div>
          </button>

          {/* ── Dropdown menu ─────────────────────────────────────────────── */}
          {menuOpen && (
            <div className="hdr-menu-dropdown" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 16, background: T.bg3, border: `1px solid ${T.cardBorder}`, borderRadius: 18, padding: '8px', minWidth: 288, maxWidth: 340, boxShadow: '0 20px 60px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.04)', zIndex: 200, maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto', animation: 'slideUp .18s ease' }}>

              {/* ── Bouton fermeture ──────────────────────────────────── */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                <button
                  onClick={closeMenu}
                  aria-label="Fermer le menu"
                  style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 8, color: T.textMuted, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                >✕</button>
              </div>

              {/* ── Overlay pages ─────────────────────────────────────── */}
              {profilePage ? (
                <ProfilePage
                  T={T}
                  user={user}
                  accent={accent}
                  onBack={() => { setProfilePage(false); setDisplayName(localStorage.getItem('ct_displayname') || ''); }}
                  currency={currency}
                  setCurrency={setCurrency}
                  language={language}
                  setLanguage={setLanguage}
                  notifEnabled={notifEnabled}
                  handleNotif={handleNotif}
                />
              ) : trophiesPage ? (
                <TrophiesPage
                  T={T}
                  accent={accent}
                  onBack={() => setTrophiesPage(false)}
                  data={data}
                />
              ) : (
              <>

              {/* ── 0. CHANGER DE PROFIL ───────────────────────────── */}
              {user && !demoMode && (
                <>
                  <SLabel>Changer de profil</SLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '2px 0' }}>
                    <button
                      onClick={() => switchProfile(null)}
                      style={{ width: '100%', background: activeProfileId === null ? accent + '18' : 'transparent', border: `1px solid ${activeProfileId === null ? accent + '44' : 'transparent'}`, borderRadius: 10, color: T.text, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .1s' }}
                      onMouseEnter={e => { if (activeProfileId !== null) e.currentTarget.style.background = T.cardBg; }}
                      onMouseLeave={e => { if (activeProfileId !== null) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: accent + '28', border: `1px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: accent, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, textAlign: 'left', fontWeight: activeProfileId === null ? 600 : 400 }}>Principal</span>
                      {activeProfileId === null && <span style={{ fontSize: 13, color: accent }}>✓</span>}
                    </button>
                    {(profiles || []).map(p => (
                      <button
                        key={p.id}
                        onClick={() => switchProfile(p.id)}
                        style={{ width: '100%', background: activeProfileId === p.id ? accent + '18' : 'transparent', border: `1px solid ${activeProfileId === p.id ? accent + '44' : 'transparent'}`, borderRadius: 10, color: T.text, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .1s' }}
                        onMouseEnter={e => { if (activeProfileId !== p.id) e.currentTarget.style.background = T.cardBg; }}
                        onMouseLeave={e => { if (activeProfileId !== p.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: accent + '28', border: `1px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: accent, flexShrink: 0 }}>
                          {p.label.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ flex: 1, fontSize: 13, textAlign: 'left', fontWeight: activeProfileId === p.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                        {activeProfileId === p.id && <span style={{ fontSize: 13, color: accent }}>✓</span>}
                      </button>
                    ))}
                  </div>
                  <MBtn icon="＋" label="Ajouter un profil" onClick={() => setAddProfileModal(true)} muted />
                  <Divider />
                </>
              )}

              {/* ── 1. PROFIL ──────────────────────────────────────── */}
              {(user || demoMode) && (
                <>
                  <SLabel>{t('menu_profile')}</SLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: T.cardBg, borderRadius: 12, margin: '4px 0' }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: accent + '28', border: `2px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: accent, flexShrink: 0, letterSpacing: '-.02em' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName || (demoMode ? t('menu_demo_data') : email.split('@')[0])}
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {demoMode ? t('menu_demo_data') : email}
                      </div>
                    </div>
                    {demoMode && (
                      <span style={{ fontSize: 9, background: 'rgba(251,146,60,.15)', color: '#fb923c', padding: '2px 7px', borderRadius: 6, fontWeight: 700, letterSpacing: '.05em', flexShrink: 0 }}>DÉMO</span>
                    )}
                  </div>
                  {!demoMode && (
                    <MBtn icon="✎" label={t('menu_edit_profile')} onClick={() => setProfilePage(true)} />
                  )}
                  <MBtn icon="🏆" label="Trophées & Statut" onClick={() => setTrophiesPage(true)} />
                  <Divider />
                </>
              )}

              {/* ── 2. APPARENCE ───────────────────────────────────── */}
              <SLabel>{t('menu_appearance')}</SLabel>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{darkMode ? '🌙' : '☀️'}</span>
                <span style={{ flex: 1, fontSize: 13, color: T.text }}>{t('menu_theme')}</span>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: darkMode ? accent : T.cardBorder, border: 'none', cursor: 'pointer', transition: 'background .2s', padding: 0, flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 2, left: darkMode ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                </button>
                <span style={{ fontSize: 11, color: T.textMuted, minWidth: 36 }}>{darkMode ? t('menu_dark') : t('menu_light')}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🎨</span>
                <span style={{ flex: 1, fontSize: 13, color: T.text }}>{t('menu_color')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {ACCENT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      title={opt.label}
                      onClick={() => setAccent(opt.key)}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: opt.main, border: accentKey === opt.key ? `3px solid ${T.text}` : `2px solid transparent`, cursor: 'pointer', padding: 0, outline: 'none', boxShadow: accentKey === opt.key ? `0 0 0 1px ${opt.main}` : 'none', transition: 'transform .1s', transform: accentKey === opt.key ? 'scale(1.15)' : 'scale(1)' }}
                    />
                  ))}
                </div>
              </div>

              <Divider />

              {/* ── 3. PARAMÈTRES ──────────────────────────────────── */}
              <SLabel>{t('menu_settings')}</SLabel>

              <MSelect
                icon="💱" label={t('menu_currency')}
                value={currency} options={CURRENCIES}
                onChange={setCurrency}
              />
              <MSelect
                icon="🌐" label={t('menu_language')}
                value={language}
                options={[{ key: 'fr', label: 'Français' }, { key: 'en', label: 'English' }]}
                onChange={setLanguage}
              />
              <MSelect
                icon="📅" label={t('menu_date_format')}
                value={dateFormat} options={DATE_FORMATS}
                onChange={setDateFormat}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🔔</span>
                <span style={{ flex: 1, fontSize: 13, color: T.text }}>{t('menu_notifications')}</span>
                <button
                  onClick={handleNotif}
                  style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: notifEnabled ? accent : T.cardBorder, border: 'none', cursor: 'pointer', transition: 'background .2s', padding: 0, flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 2, left: notifEnabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                </button>
                <span style={{ fontSize: 11, color: T.textMuted, minWidth: 36 }}>{notifEnabled ? t('menu_notif_on') : t('menu_notif_off')}</span>
              </div>

              <Divider />

              {/* ── 4. DONNÉES ─────────────────────────────────────── */}
              <SLabel>{t('menu_data')}</SLabel>

              {importFeedback && (
                <div style={{ margin: '0 8px 6px', padding: '8px 12px', background: importFeedback.startsWith('✅') ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.1)', borderRadius: 8, fontSize: 12, color: importFeedback.startsWith('✅') ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                  {importFeedback}
                </div>
              )}

              <MBtn icon="⬇" label={t('menu_export_json')} onClick={() => { exportDataJSON(); closeMenu(); }} />
              <MBtn icon="⬇" label={t('menu_export_csv')}  onClick={() => { exportCSV(); closeMenu(); }} />
              <MBtn icon="⬆" label={t('menu_import_json')} onClick={() => fileInputRef.current?.click()} />
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />

              {!demoMode && user && !deleteConfirm && (
                <MBtn icon="🗑" label={t('menu_delete_account')} onClick={() => setDeleteConfirm(true)} danger />
              )}
              {deleteConfirm && (
                <div style={{ margin: '4px 8px', padding: '12px', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginBottom: 8 }}>⚠ {t('menu_delete_confirm')}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={async () => { closeMenu(); await deleteAccount(); }} style={{ flex: 1, background: '#f87171', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('menu_confirm')}
                    </button>
                    <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.textMuted, padding: '7px 0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('menu_cancel')}
                    </button>
                  </div>
                </div>
              )}

              <Divider />

              {/* ── 5. À PROPOS ────────────────────────────────────── */}
              <SLabel>{t('menu_about')}</SLabel>
              <MBtn icon="🎓" label="Tutoriel" onClick={() => { closeMenu(); onStartTutorial?.(); }} />
              <MBtn icon="📜" label="Mentions légales"            onClick={() => setLegalModal('mentions')} />
              <MBtn icon="🔒" label="Politique de confidentialité" onClick={() => setLegalModal('privacy')} />
              <MBtn icon="📋" label="CGU"                          onClick={() => setLegalModal('cgu')} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px' }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>✉️</span>
                <span style={{ fontSize: 12, color: accent }}>contact@capitaly.fr</span>
              </div>

              <Divider />

              {/* ── 6. DÉCONNEXION ─────────────────────────────────── */}
              {demoMode ? (
                <MBtn icon="→" label={t('menu_login')} onClick={() => { handleLogout(); closeMenu(); }} />
              ) : user ? (
                <button
                  onClick={() => { handleLogout(); closeMenu(); }}
                  style={{ width: '100%', background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 10, color: '#f87171', padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background .15s', margin: '2px 0 0' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,.06)'}
                >
                  <span style={{ fontSize: 15 }}>⎋</span>
                  {t('menu_logout')}
                </button>
              ) : null}

              </> /* end of regular menu */
              )} {/* end of profilePage ternary */}
            </div>
          )}
        </div>
      </div>
    </header>
    {addProfileModal && (
      <div
        onClick={e => { if (e.target === e.currentTarget) { setAddProfileModal(false); setAddProfileLabel(''); } }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <div style={{ background: '#111827', border: `1px solid ${T.cardBorder}`, borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>Ajouter un profil</h2>
            <button
              onClick={() => { setAddProfileModal(false); setAddProfileLabel(''); }}
              style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, color: '#e5e7eb', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontFamily: 'inherit' }}
            >✕</button>
          </div>
          <input
            autoFocus
            type="text"
            placeholder="Prénom ou label (ex: Madame, Investissements…)"
            value={addProfileLabel}
            onChange={e => setAddProfileLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddProfile(); }}
            style={{ width: '100%', padding: '10px 14px', background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
          />
          <button
            onClick={handleAddProfile}
            disabled={addProfileLoading || !addProfileLabel.trim()}
            style={{ width: '100%', background: accent, border: 'none', borderRadius: 10, color: '#fff', padding: '10px', fontSize: 14, fontWeight: 600, cursor: addProfileLoading || !addProfileLabel.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: addProfileLoading || !addProfileLabel.trim() ? 0.6 : 1, transition: 'opacity .15s' }}
          >
            {addProfileLoading ? 'Création…' : 'Créer le profil'}
          </button>
        </div>
      </div>
    )}
    {legalModal && (() => {
      const TITLES = {
        mentions: 'Mentions légales',
        privacy:  'Politique de confidentialité',
        cgu:      'Conditions Générales d\'Utilisation',
      };
      const Row = ({ label, value }) => (
        <div style={{ padding: '10px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{value}</div>
        </div>
      );
      const Note = ({ children }) => (
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, padding: '10px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
          {children}
        </div>
      );
      const content = {
        mentions: (
          <>
            <Row label="Éditeur" value="Alexandre Bourguignon" />
            <Row label="Application" value="Capitaly" />
            <Row label="Hébergement" value="Vercel Inc." />
            <Row label="Contact" value="contact@capitaly.fr" />
            <Note>Capitaly est un outil de suivi personnel, pas un conseiller financier agréé.</Note>
          </>
        ),
        privacy: (
          <>
            <Row label="Données collectées" value="Email, données financières saisies manuellement" />
            <Row label="Stockage" value="Supabase (chiffré, serveurs EU)" />
            <Row label="Vente de données" value="Aucune vente à des tiers" />
            <Row label="Droits (accès, rectification, suppression)" value="contact@capitaly.fr" />
            <Note>Capitaly est conforme au Règlement Général sur la Protection des Données (RGPD).</Note>
          </>
        ),
        cgu: (
          <>
            <Note>Capitaly est un outil d'aide à la gestion personnelle des finances.</Note>
            <Note>Les informations fournies ne constituent pas des conseils en investissement.</Note>
            <Note>L'utilisateur est seul responsable de ses décisions financières.</Note>
            <Note>L'utilisation de Capitaly est réservée aux personnes majeures.</Note>
          </>
        ),
      };
      return (
        <div
          onClick={e => { if (e.target === e.currentTarget) setLegalModal(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ background: '#111827', border: `1px solid ${T.cardBorder}`, borderRadius: 20, padding: 24, maxWidth: 480, width: '100%', maxHeight: '80dvh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text }}>{TITLES[legalModal]}</h2>
              <button
                onClick={() => setLegalModal(null)}
                style={{ background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, color: '#e5e7eb', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontFamily: 'inherit' }}
              >✕</button>
            </div>
            {content[legalModal]}
          </div>
        </div>
      );
    })()}
    </>
  );
}
