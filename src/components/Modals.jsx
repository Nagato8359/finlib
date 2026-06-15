import { useState, useRef, useEffect } from 'react';
import { makeS, fEur, fDate, today, uid, CAT_COLORS, HEALTH_CATS, CASH_TYPES, CASH_TYPE_INFO, ITEM_CONDITIONS, PORTFOLIO_TYPES, PORTFOLIO_TYPE_ICON, PORTFOLIO_BROKERS_PEA, PORTFOLIO_BROKERS_CTO, PORTFOLIO_AV_TYPES, PORTFOLIO_AV_INSURERS, PORTFOLIO_CRYPTO_PLATFORMS, PORTFOLIO_CRYPTO_TYPES, PORTFOLIO_IMMO_TYPES, PORTFOLIO_PE_TYPES } from '../utils/constants';
import { useTranslation } from '../hooks/useTranslation';
// modal === 'drill' (position form) is handled by PositionFormModal in App.js

// ── Local atoms ───────────────────────────────────────────────────────────────
const CMShell = ({ T, title, icon, color, onClose, maxWidth = 560, children }) => (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}
  >
    <div style={{ background: T.bg3, border: `1px solid ${color}30`, borderRadius: 20, width: '100%', maxWidth, margin: '0 16px', overflow: 'hidden', boxShadow: `0 32px 80px rgba(0,0,0,.65), 0 0 0 1px ${color}18`, animation: 'slideUp .2s ease' }}>
      <div style={{ background: `linear-gradient(135deg,${color}1a,${color}0a)`, borderBottom: `1px solid ${color}25`, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 42, height: 42, background: color + '22', border: `1px solid ${color}45`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {icon}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>{title}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: T.textMuted, padding: '5px 12px', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '22px 24px' }}>{children}</div>
    </div>
  </div>
);

const FRow = ({ cols = 2, children }) => <div className={`frow frow-${cols}`}>{children}</div>;
const Lbl = ({ children }) => (
  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</label>
);
const FField = ({ label, children, style }) => <div style={style}><Lbl>{label}</Lbl>{children}</div>;
const CBtn = ({ color, onClick, children, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{ background: disabled ? '#4b5563' : `linear-gradient(135deg,${color},${color}cc)`, border: 'none', borderRadius: 10, color: '#fff', padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
    {children}
  </button>
);
const fa = color => ({ paddingLeft: 10, borderLeft: `3px solid ${color}45`, borderRadius: '0 0 0 3px' });

const mLeft = endDate => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()));
};

// ── Static data for universal search ─────────────────────────────────────────
const COMMODITY_KEYWORDS = [
  { keywords: ['or', 'gold'],               name: 'Or',        ticker: 'GC=F', commodityType: 'Or',        icon: '🥇' },
  { keywords: ['argent', 'silver'],         name: 'Argent',    ticker: 'SI=F', commodityType: 'Argent',    icon: '🪙' },
  { keywords: ['platine', 'platinum'],      name: 'Platine',   ticker: 'PL=F', commodityType: 'Platine',   icon: '⬜' },
  { keywords: ['palladium'],                name: 'Palladium', ticker: 'PA=F', commodityType: 'Palladium', icon: '🔘' },
  { keywords: ['pétrole', 'petrol', 'oil'], name: 'Pétrole',   ticker: 'CL=F', commodityType: 'Pétrole',   icon: '🛢️' },
  { keywords: ['cuivre', 'copper'],         name: 'Cuivre',    ticker: 'HG=F', commodityType: 'Cuivre',    icon: '🔶' },
];
const normalizeStr = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SCPI_LIST = [
  // Corum
  'Corum Origin', 'Corum XL', 'Corum Eurion', 'Corum USA',
  // Sofidy
  'Immorente', 'Immorente 2', 'Sofidy Europe Invest', 'Sofidy Pierre Europe',
  // Perial
  'PFO', 'PFO2', 'PF Grand Paris',
  // Efimmo / Iroko
  'Efimmo 1', 'Iroko Zen',
  // Rivoli
  'Rivoli Avenir Patrimoine',
  // Primonial
  'Primopierre', 'Primovie', 'Coeur de Régions', 'Coeur de Ville',
  // BNP Paribas REIM
  'Pierre 48', 'France Investipierre', 'Accimmo Pierre',
  // Swiss Life REIM
  'Épargne Foncière', 'Pierre Expansion Santé', 'Capimmo', 'Swisslife ESG Immobi Invest',
  // Amundi
  'Interpierre France', 'Interpierre Europe', 'Novapierre Résidentiel', 'Novapierre Allemagne', 'Novapierre Allemagne 2',
  // Norma Capital
  'Vendôme Régions', 'Fair Invest',
  // Praemia (ex-La Française)
  'LF Grand Paris Patrimoine', 'LF Opportunité Immo', 'Praemia Convictions',
  // Altixia
  'Altixia Cadence XII', 'Altixia Commerces',
  // Atland Voisin
  'Foncière Rémusat', 'Opus Real Estate',
  // Arkéa REIM
  'Territoires Durables', 'Patrimmo Commerce', 'Patrimmo Croissance',
  // Advenis REIM
  'Elialys', 'Eurovalys',
  // Remake
  'Remake Live',
  // Transitions
  'Transitions Europe',
  // Sogenial
  'Cœur de Ville', 'Cœur d\'Europe',
  // Fiducial
  'Fiducial Gérance', 'Fiducial Retraite',
  // MNK Partners
  'MNK One',
  // Keys REIM
  'Keys Eurozone', 'Keys Impact',
  // Groupama REIM
  'Groupama Gan Pierre 1',
  // Paref Gestion
  'Interpierre Europe', 'Novapierre 1',
  // Perial
  'Euro Caralis', 'PF Hospitalité Europe',
  // Theoreim
  'Theoreim Logistique',
  // Consultim
  'Cœur de Régions',
  // Sofidy
  'Efimmo Santé',
  // Aestiam
  'Aestiam Pierre Rendement', 'Aestiam Placement Pierre', 'Aestiam Cap Santé',
  // Alderan
  'Alderan Commerces', 'Commerces Régions',
  // Fiducial Gerance
  'Selectinvest 1', 'Selectinvest 2',
  // Patrimmo
  'Patrimmo Commerces',
  // Générations Pierre
  'Générations Pierre',
  // Greenman Arth
  'Greenman Arth',
  // Log In
  'Log In',
  // Idéal Résidence
  'Idéal Résidence',
];
const CRYPTO_LOCAL = [
  { symbol: 'BTC',   name: 'Bitcoin',    id: 'bitcoin',            thumb: '' },
  { symbol: 'ETH',   name: 'Ethereum',   id: 'ethereum',           thumb: '' },
  { symbol: 'BNB',   name: 'BNB',        id: 'binancecoin',        thumb: '' },
  { symbol: 'SOL',   name: 'Solana',     id: 'solana',             thumb: '' },
  { symbol: 'XRP',   name: 'XRP',        id: 'ripple',             thumb: '' },
  { symbol: 'ADA',   name: 'Cardano',    id: 'cardano',            thumb: '' },
  { symbol: 'AVAX',  name: 'Avalanche',  id: 'avalanche-2',        thumb: '' },
  { symbol: 'DOT',   name: 'Polkadot',   id: 'polkadot',           thumb: '' },
  { symbol: 'MATIC', name: 'Polygon',    id: 'matic-network',      thumb: '' },
  { symbol: 'LINK',  name: 'Chainlink',  id: 'chainlink',          thumb: '' },
  { symbol: 'UNI',   name: 'Uniswap',    id: 'uniswap',            thumb: '' },
  { symbol: 'AAVE',  name: 'Aave',       id: 'aave',               thumb: '' },
  { symbol: 'INJ',   name: 'Injective',  id: 'injective-protocol', thumb: '' },
  { symbol: 'FET',   name: 'Fetch.ai',   id: 'fetch-ai',           thumb: '' },
  { symbol: 'EGLD',  name: 'MultiversX', id: 'elrond-erd-2',       thumb: '' },
];

// ── Asset logo helpers ────────────────────────────────────────────────────────
// sources: ordered array of URLs to try — onError advances to the next, then falls back to letter circle
export const AssetLogo = ({ sources = [], letter, color, size = 32 }) => {
  const [idx, setIdx] = useState(0);
  if (idx >= sources.length) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.44), fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {letter}
    </div>
  );
  return <img src={sources[idx]} alt="" onError={() => setIdx(i => i + 1)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', background: '#fff', padding: 2, boxSizing: 'border-box', flexShrink: 0 }} />;
};

// Ticker (base, no exchange suffix) → company domain
// Used by Logo.dev (primary) and Google favicons (fallback)
export const TICKER_TO_DOMAIN = {
  // ── France CAC40 / SBF120 ─────────────────────────────────────────────────
  TTE: 'totalenergies.com', FP: 'totalenergies.com',
  AI: 'airbus.com', BNP: 'bnpparibas.com',
  SAN: 'sanofi.com', MC: 'lvmh.com', OR: 'loreal.com',
  RMS: 'hermes.com', TFI: 'tf1.fr', ORA: 'orange.com',
  VIE: 'veolia.com', DG: 'vinci.com', RI: 'pernod-ricard.com',
  CA: 'carrefour.com', BN: 'danone.com', ENGI: 'engie.com',
  SGO: 'saint-gobain.com', ML: 'michelin.com', ACA: 'credit-agricole.com',
  GLE: 'societegenerale.com', KER: 'kering.com', CAP: 'capgemini.com',
  DSY: 'dassault-systemes.com', STM: 'st.com', PUB: 'publicis.com',
  RNO: 'renault.com', SU: 'schneider-electric.com', SW: 'schneider-electric.com',
  LR: 'legrand.com', EL: 'essilorluxottica.com', TEP: 'teleperformance.com',
  HO: 'thalesgroup.com', AXA: 'axa.com', CS: 'axa.com',
  SAF: 'safran.com', AC: 'accor.com', ALO: 'alstom.com',
  NK: 'nexans.com', WLN: 'worldline.com',
  // ── Europe ────────────────────────────────────────────────────────────────
  ASML: 'asml.com', SAP: 'sap.com', NESN: 'nestle.com',
  NOVN: 'novartis.com', ROG: 'roche.com', SHELL: 'shell.com',
  BP: 'bp.com', SIE: 'siemens.com', ALV: 'allianz.com',
  BMW: 'bmw.com', VOW3: 'volkswagen.com', ADS: 'adidas.com',
  BAS: 'basf.com', DTE: 'telekom.com', MUV2: 'munichre.com',
  BAYN: 'bayer.com', DBK: 'db.com', MBG: 'mercedes-benz.com',
  ENEL: 'enel.com', ENI: 'eni.com', ISP: 'intesasanpaolo.com',
  UCG: 'unicredit.com', PRY: 'prysmiangroup.com', NOKIA: 'nokia.com',
  // ── États-Unis ────────────────────────────────────────────────────────────
  AAPL: 'apple.com', MSFT: 'microsoft.com', GOOGL: 'google.com', GOOG: 'google.com',
  AMZN: 'amazon.com', META: 'meta.com', TSLA: 'tesla.com', NVDA: 'nvidia.com',
  JPM: 'jpmorganchase.com', V: 'visa.com', MA: 'mastercard.com',
  JNJ: 'jnj.com', WMT: 'walmart.com', PG: 'pg.com',
  UNH: 'unitedhealthgroup.com', HD: 'homedepot.com', BAC: 'bankofamerica.com',
  DIS: 'disney.com', NFLX: 'netflix.com', PYPL: 'paypal.com',
  ADBE: 'adobe.com', CRM: 'salesforce.com', INTC: 'intel.com',
  AMD: 'amd.com', ORCL: 'oracle.com', UBER: 'uber.com',
  SPOT: 'spotify.com', COIN: 'coinbase.com', SQ: 'block.xyz',
  GS: 'goldmansachs.com', MS: 'morganstanley.com', PFE: 'pfizer.com',
  KO: 'coca-cola.com', PEP: 'pepsico.com', NKE: 'nike.com',
  ABNB: 'airbnb.com', SHOP: 'shopify.com', SNAP: 'snap.com',
  T: 'att.com', VZ: 'verizon.com', AMGN: 'amgen.com',
  COST: 'costco.com', AVGO: 'broadcom.com', LLY: 'lilly.com',
  // ── ETF populaires ────────────────────────────────────────────────────────
  SPY: 'ssga.com', QQQ: 'invesco.com', IWDA: 'ishares.com',
  CSPX: 'ishares.com', VWCE: 'vanguard.com', WPEA: 'amundi.com',
  CW8: 'amundi.com', ESE: 'etfsecurities.com', LCWD: 'lgim.com',
  MEUD: 'lyxoretf.com', LQQ: 'lyxoretf.com',
};

export const LOGO_DEV_TOKEN = 'pk_X4dPbXQbTBuiGqrJH9u8VA';

// SCPI: keyword (lowercase substring) → management company domain
const SCPI_DOMAINS = {
  'corum':         'corum.eu',
  'sofidy':        'sofidy.com',
  'primonial':     'primonial-reim.fr',
  'perial':        'perial.com',
  'iroko':         'iroko.eu',
  'remake':        'remake.immo',
  'inter gestion': 'inter-gestion.com',
  'theoreim':      'theoreim.com',
};

// Returns ordered logo sources for stocks/ETF:
//   1. asset.logoUrl — API-provided field (prioritised if present)
//   2. Logo.dev by domain — covers companies worldwide (known domains only)
//   3. Google favicons — universal last resort (known domains only)
export const stockLogoSources = (sym, logoUrl) => {
  const srcs = [];
  if (logoUrl) srcs.push(logoUrl);
  if (!sym) return srcs;
  const base   = sym.split('.')[0].toUpperCase();
  const domain = TICKER_TO_DOMAIN[base];
  if (domain) srcs.push(`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=64`);
  if (domain) srcs.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
  return srcs;
};

// Returns logo sources for SCPI: Logo.dev then Google favicon if manager keyword matched
export const scpiLogoSources = name => {
  const lower  = name.toLowerCase();
  const key    = Object.keys(SCPI_DOMAINS).find(k => lower.includes(k));
  if (!key) return [];
  const domain = SCPI_DOMAINS[key];
  return [
    `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=64`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  ];
};

// ── Color maps for modals ─────────────────────────────────────────────────────
const PORTFOLIO_MODAL_COLOR = {
  PEA: '#10B981', CTO: '#10B981',
  'Assurance-vie': '#3B82F6',
  Crypto: '#F59E0B',
  Immobilier: '#8B5CF6',
  'Épargne salariale': '#06B6D4',
  Autre: '#94A3B8',
  // Immobilier fractionné
  RealT: '#EF4444', 'La Première Brique': '#F97316', Tantiem: '#EA580C', 'Bricks.co': '#DC2626', 'Crowdfunding immobilier': '#B45309',
  // SCPI / Pierre-papier
  SCPI: '#D97706', OPCI: '#CA8A04', SCI: '#A16207',
  // Alternatifs
  'Private Equity': '#7C3AED', 'Crowdfunding entreprise': '#6D28D9', Obligations: '#2563EB', 'Art & Collections': '#DB2777', 'Forêts / GFI': '#16A34A', 'Vignes / GFV': '#9333EA',
  // Épargne long terme
  PER: '#0891B2', 'Assurance-vie fonds euros': '#6366F1',
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function Modals({ T, data }) {
  const S = makeS(T);
  const { t } = useTranslation();
  const TX_META = {
    income:         { color: '#10B981', icon: '📈', label: t('tx_type_income') },
    expense:        { color: '#EF4444', icon: '💳', label: t('tx_type_expense') },
    transfer:       { color: '#60A5FA', icon: '↕️',  label: t('tx_type_transfer') },
    loan_repayment: { color: '#FB923C', icon: '🏦', label: t('tx_type_repayment') },
  };
  const {
    modal, setModal, editItem, setEditItem,
    txForm, setTxForm, healthForm, setHealthForm,
    goalForm, setGoalForm, cashForm, setCashForm,
    listingForm, setListingForm, loanForm, setLoanForm, debtForm, setDebtForm,
    mkTx, mkHealth, mkCash, mkListing, mkLoan, mkDebt, mkPortfolio,
    saveTx, saveHealth, saveListing, saveCash, saveGoal, saveLoan, saveDebt,
    savePortfolio,
    portfolioForm, setPortfolioForm,
    investments, setInvestments,
    allAccounts, computedLoans,
    listings, soldHistory,
    divForm, setDivForm, divInvId, addDividend,
    customBudgets, customBudgetForm, setCustomBudgetForm, saveCustomBudget, mkCustomBudget,
  } = data;

  const BUDGET_ICONS   = ['🛒','🍔','🚗','🏠','💊','🎮','✈️','👔','📚','🎵','💆','🐾','🏋️','🍷','☕','🎁','📱','💻','🔧','🌿','🛍️','🎬','⚽','🎨','🎂'];
  const BUDGET_COLORS  = ['#10b981','#f87171','#fb923c','#fbbf24','#a78bfa','#60a5fa','#34d399','#f472b6','#94a3b8','#f59e0b','#06b6d4','#84cc16'];

  const [addInvSearch, setAddInvSearch]         = useState('');
  const [addInvResults, setAddInvResults]       = useState([]);
  const [addInvLoading, setAddInvLoading]       = useState(false);
  const [addInvAsset, setAddInvAsset]           = useState(null);
  const [addInvEnvId, setAddInvEnvId]           = useState('');
  const [addInvStep, setAddInvStep]             = useState(0);
  const [addInvForm, setAddInvForm]             = useState({ shares: '', buyPrice: '', currentPrice: '', purchaseDate: today() });
  const [addInvPriceFetching, setAddInvPriceFetching] = useState(false);
  const [confirmDel, setConfirmDel]             = useState(null);
  const addInvTimerRef                          = useRef(null);
  const addInvPendingAssetRef                   = useRef(null);  // asset kept alive during portfolio creation detour
  const invCountRef                             = useRef(0);     // snapshot of investments.length before portfolio creation
  const prevModalRef                            = useRef(null);

  // After portfolio creation: if we had a pending asset, auto-resume at step 2 with the new envelope
  useEffect(() => {
    const prev = prevModalRef.current;
    prevModalRef.current = modal;
    if (prev !== 'portfolio' || modal || !addInvPendingAssetRef.current) return;
    const asset = addInvPendingAssetRef.current;
    const currentEnvs = investments || [];
    if (currentEnvs.length > invCountRef.current) {
      // A new envelope was saved — jump straight to asset form
      const newEnv = currentEnvs[currentEnvs.length - 1];
      const ticker = asset._kind === 'commodity' ? asset.ticker : (asset.symbol || asset.id || '');
      addInvPendingAssetRef.current = null;
      setAddInvAsset(asset);
      setAddInvEnvId(newEnv.id);
      setAddInvStep(2);
      setAddInvForm({ shares: '', buyPrice: '', currentPrice: '', purchaseDate: today() });
      if (ticker) {
        setAddInvPriceFetching(true);
        fetch(`/api/price/${encodeURIComponent(ticker)}`)
          .then(r => r.json())
          .then(d => { if (d.price != null) setAddInvForm(p => ({ ...p, currentPrice: String(parseFloat(d.price.toFixed(4))) })); })
          .catch(() => {})
          .finally(() => setAddInvPriceFetching(false));
      }
      setModal('addInvestment');
    } else {
      // User cancelled portfolio creation — clear pending state
      addInvPendingAssetRef.current = null;
      setAddInvStep(0);
      setAddInvAsset(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, investments]);

  const [realtAddr, setRealtAddr]               = useState('');
  const [realtLoading, setRealtLoading]         = useState(false);
  const [realtErr, setRealtErr]                 = useState('');
  const [realtTokens, setRealtTokens]           = useState(null);
  const [realtManualPrices, setRealtManualPrices] = useState({});
  const resetRealt = () => { setRealtAddr(''); setRealtLoading(false); setRealtErr(''); setRealtTokens(null); setRealtManualPrices({}); };
  const searchRealt = async () => {
    const a = realtAddr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/i.test(a)) { setRealtErr('Adresse invalide — format 0x + 40 hex'); return; }
    setRealtLoading(true); setRealtErr(''); setRealtTokens(null);
    try {
      const res = await fetch(`/api/realt?action=wallet&address=${a}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setRealtTokens(d.tokens || []);
      setRealtManualPrices({});
    } catch (e) { setRealtErr(e.message); }
    finally { setRealtLoading(false); }
  };

  if (!modal) return null;
  const close = reset => { setModal(null); setEditItem(null); setConfirmDel(null); reset && reset(); };

  // ── Transaction ──────────────────────────────────────────────────────────────
  if (modal === 'tx') {
    const meta  = TX_META[txForm.type] || TX_META.expense;
    const c     = meta.color;
    const f     = fa(c);
    const isTransfer   = txForm.type === 'transfer';
    const isRepayment  = txForm.type === 'loan_repayment';
    const acctLabel    = txForm.type === 'income' ? t('tx_account_credit') : isTransfer ? t('tx_account_source') : t('tx_account_debit');
    return (
      <CMShell T={T} icon={meta.icon} color={c} onClose={() => close(() => setTxForm(mkTx()))}
        title={editItem ? t('modal_tx_edit', meta.label) : t('modal_tx_new', meta.label)}>
        <FRow cols={2}>
          <FField style={f} label={t('f_date')}><input type="date" style={S.inp} value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} /></FField>
          <FField style={f} label={t('f_type')}>
            <select style={S.inp} value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))}>
              <option value="income">{t('tx_income_option')}</option>
              <option value="expense">{t('tx_expense_option')}</option>
              <option value="transfer">{t('tx_transfer_option')}</option>
              <option value="loan_repayment">{t('tx_repayment_option')}</option>
            </select>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('f_label')}><input type="text" placeholder={isTransfer ? 'Ex : Virement PEA' : isRepayment ? 'Ex : Remb. crédit immo' : 'Ex : Salaire, Loyer…'} style={S.inp} value={txForm.label} onChange={e => setTxForm(p => ({ ...p, label: e.target.value }))} /></FField>
          <FField style={f} label={t('f_amount')}><input type="number" placeholder="0" style={S.inp} value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} /></FField>
        </FRow>
        {!isTransfer && !isRepayment && (
          <FRow cols={2}>
            <FField style={f} label={t('f_category')}>
              <select style={S.inp} value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))}>
                {Object.keys(CAT_COLORS).map(c2 => <option key={c2}>{c2}</option>)}
                {customBudgets.length > 0 && <option disabled>──────────</option>}
                {customBudgets.map(cb => <option key={cb.id} value={cb.name}>{cb.icon} {cb.name}</option>)}
              </select>
            </FField>
            <FField style={f} label={t('tx_recurrent')}>
              <select style={S.inp} value={txForm.recurrent ? 'oui' : 'non'} onChange={e => setTxForm(p => ({ ...p, recurrent: e.target.value === 'oui' }))}>
                <option value="non">{t('tx_recurrent_no')}</option>
                <option value="oui">{t('tx_recurrent_yes')}</option>
              </select>
            </FField>
          </FRow>
        )}
        <FRow cols={isTransfer ? 2 : 1}>
          <FField style={f} label={acctLabel}>
            <select style={S.inp} value={txForm.accountId} onChange={e => setTxForm(p => ({ ...p, accountId: e.target.value }))}>
              <option value="">{t('tx_no_account')}</option>
              {allAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FField>
          {isTransfer && (
            <FField style={f} label={t('tx_account_dest')}>
              <select style={S.inp} value={txForm.destAccountId} onChange={e => setTxForm(p => ({ ...p, destAccountId: e.target.value }))}>
                <option value="">{t('tx_select')}</option>
                {allAccounts.filter(a => a.id !== txForm.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FField>
          )}
        </FRow>
        {isRepayment && computedLoans.length > 0 && (
          <FRow cols={1}>
            <FField style={f} label={t('tx_loan_optional')}>
              <select style={S.inp} value={txForm.loanId} onChange={e => setTxForm(p => ({ ...p, loanId: e.target.value }))}>
                <option value="">{t('tx_no_loan')}</option>
                {computedLoans.map(l => <option key={l.id} value={l.id}>{l.name} — {new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(l.computedRemaining)} restants</option>)}
              </select>
            </FField>
          </FRow>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveTx}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setTxForm(mkTx()))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Sélecteur de type d'investissement (style Finary) ────────────────────────
  if (modal === 'addInvestment') {
    const resetAddInv = () => {
      setAddInvSearch(''); setAddInvResults([]); setAddInvLoading(false);
      setAddInvAsset(null); setAddInvEnvId(''); setAddInvStep(0);
      setAddInvForm({ shares: '', buyPrice: '', currentPrice: '', purchaseDate: today() });
      setAddInvPriceFetching(false);
      if (addInvTimerRef.current) clearTimeout(addInvTimerRef.current);
    };

    const doSearch = async q => {
      if (!q || q.length < 2) { setAddInvResults([]); setAddInvLoading(false); return; }
      setAddInvLoading(true);
      try {
        const [sr, cr] = await Promise.allSettled([
          fetch(`/api/search?type=stock&q=${encodeURIComponent(q)}`).then(r => r.json()),
          fetch(`/api/search?type=crypto&q=${encodeURIComponent(q)}`).then(r => r.json()),
        ]);
        const stocks  = (sr.status === 'fulfilled' && Array.isArray(sr.value))  ? sr.value.map(r => ({ ...r, _kind: 'stock'  })) : [];
        const cryptos = (cr.status === 'fulfilled' && Array.isArray(cr.value))  ? cr.value.map(r => ({ ...r, _kind: 'crypto' })) : [];
        setAddInvResults([...stocks, ...cryptos]);
      } catch { setAddInvResults([]); }
      setAddInvLoading(false);
    };

    const onSearchChange = val => {
      setAddInvSearch(val);
      if (addInvTimerRef.current) clearTimeout(addInvTimerRef.current);
      if (val.length < 2) { setAddInvResults([]); setAddInvLoading(false); return; }
      setAddInvLoading(true);
      addInvTimerRef.current = setTimeout(() => doSearch(val), 300);
    };

    const selectScpi = name => {
      setPortfolioForm({ ...mkPortfolio(), type: 'SCPI', name, adresse: name });
      resetAddInv(); setModal('portfolio');
    };

    const isCryptoEnv = inv => {
      const t = (inv.type || '').toLowerCase().trim();
      return t.includes('crypto') || t === 'bitcoin' || t === 'ethereum';
    };
    const isStockEnv = inv => {
      const t = (inv.type || '').toLowerCase().trim();
      return ['pea', 'cto', 'compte-titres', 'compte titres',
              'assurance-vie', 'assurance vie', 'épargne salariale',
              'epargne salariale'].some(k => t.includes(k));
    };
    const compatEnvs = asset => {
      if (asset._kind === 'crypto')    return (investments || []).filter(isCryptoEnv);
      if (asset._kind === 'commodity') return (investments || []).filter(inv => (inv.type || '').toLowerCase().includes('matière') || inv.type === 'Matières premières');
      return (investments || []).filter(isStockEnv);
    };

    const selectEnv = async (envId, ticker) => {
      setAddInvEnvId(envId); setAddInvStep(2);
      if (!ticker) return;
      setAddInvPriceFetching(true);
      try {
        const r = await fetch(`/api/price/${encodeURIComponent(ticker)}`);
        const d = await r.json();
        if (d.price != null) setAddInvForm(p => ({ ...p, currentPrice: String(parseFloat(d.price.toFixed(4))) }));
      } catch {}
      setAddInvPriceFetching(false);
    };

    const saveAsset = () => {
      if (!addInvAsset || !addInvEnvId || !addInvForm.shares || !addInvForm.buyPrice) return;
      const isCom = addInvAsset._kind === 'commodity';
      const isCr  = addInvAsset._kind === 'crypto';
      const pos = {
        id: uid(), isin: '',
        ticker:        isCom ? addInvAsset.ticker : (addInvAsset.symbol || addInvAsset.id || ''),
        name:          addInvAsset.name,
        shares:        parseFloat(addInvForm.shares),
        buyPrice:      parseFloat(addInvForm.buyPrice),
        currentPrice:  parseFloat(addInvForm.currentPrice) || parseFloat(addInvForm.buyPrice) || 0,
        posType:       isCr ? 'crypto' : isCom ? 'commodity' : 'stock',
        commodityType: isCom ? addInvAsset.commodityType : '',
        purchaseDate:  addInvForm.purchaseDate,
        divYield: 0, exchange: addInvAsset.exchange || '', currency: 'EUR',
        platform: '', notes: '',
      };
      setInvestments(prev => prev.map(inv =>
        inv.id !== addInvEnvId ? inv : { ...inv, positions: [...(inv.positions || []), pos] }
      ));
      resetAddInv(); close();
    };

    const INVEST_GROUPS = [
      { label: 'Marchés financiers',          types: ['PEA', 'CTO', 'Assurance-vie', 'Crypto', 'Épargne salariale', 'Matières premières'] },
      { label: 'Immobilier physique',         types: ['Immobilier'] },
      { label: 'Immobilier fractionné',       types: ['RealT', 'La Première Brique', 'Tantiem', 'Bricks.co', 'Crowdfunding immobilier'] },
      { label: 'Pierre-papier',               types: ['SCPI', 'OPCI', 'SCI'] },
      { label: 'Investissements alternatifs', types: ['Private Equity', 'Crowdfunding entreprise', 'Obligations', 'Art & Collections', 'Forêts / GFI', 'Vignes / GFV'] },
      { label: 'Épargne long terme',          types: ['PER', 'Assurance-vie fonds euros'] },
      { label: 'Autre',                       types: ['Autre'] },
    ];
    const secLabel = { fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 };
    const filteredTypes = addInvSearch.length >= 2
      ? PORTFOLIO_TYPES.filter(pt => pt.toLowerCase().includes(addInvSearch.toLowerCase()))
      : null;
    const renderTile = pt => {
      const icon  = PORTFOLIO_TYPE_ICON[pt] || '📦';
      const color = PORTFOLIO_MODAL_COLOR[pt] || '#94A3B8';
      return (
        <button key={pt}
          onClick={() => { setPortfolioForm({ ...mkPortfolio(), type: pt }); setEditItem(null); resetAddInv(); setModal('portfolio'); }}
          style={{ background: T.bg2, border: `1px solid ${color}30`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.background = color + '18'; e.currentTarget.style.borderColor = color + '60'; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.borderColor = color + '30'; }}>
          <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{pt}</span>
        </button>
      );
    };

    // ── Step 2: formulaire actif ───────────────────────────────────────────────
    if (addInvStep === 2) {
      const f = fa('#10B981');
      const isCommodityStep2 = addInvAsset?._kind === 'commodity';
      return (
        <CMShell T={T} title={addInvAsset?.name || 'Ajouter un actif'} icon="📊" color="#10B981"
          onClose={() => { resetAddInv(); close(); }} maxWidth={480}>
          <button
            onClick={() => { setAddInvStep(1); setAddInvForm({ shares: '', buyPrice: '', currentPrice: '', purchaseDate: today() }); }}
            style={{ ...S.btnS, fontSize: 12, marginBottom: 18 }}>← Retour</button>
          <FRow cols={2}>
            <FField style={f} label={isCommodityStep2 ? 'Type' : 'Ticker / ID'}>
              <input readOnly type="text" style={{ ...S.inp, opacity: .6 }}
                value={isCommodityStep2 ? (addInvAsset?.commodityType || '') : (addInvAsset?.symbol || addInvAsset?.id || '')} />
            </FField>
            <FField style={f} label={addInvPriceFetching ? 'Prix actuel (€) · chargement…' : 'Prix actuel (€)'}>
              <input type="number" min="0" step="0.0001" placeholder="0.0000" style={S.inp}
                value={addInvForm.currentPrice}
                onChange={e => setAddInvForm(p => ({ ...p, currentPrice: e.target.value }))} />
            </FField>
          </FRow>
          <FRow cols={2}>
            <FField style={f} label="Quantité">
              <input type="number" min="0" step="any" placeholder="0" style={S.inp} autoFocus
                value={addInvForm.shares}
                onChange={e => setAddInvForm(p => ({ ...p, shares: e.target.value }))} />
            </FField>
            <FField style={f} label="Prix d'achat unitaire (€)">
              <input type="number" min="0" step="0.0001" placeholder="0.0000" style={S.inp}
                value={addInvForm.buyPrice}
                onChange={e => setAddInvForm(p => ({ ...p, buyPrice: e.target.value }))} />
            </FField>
          </FRow>
          <FRow cols={1}>
            <FField style={f} label="Date d'achat">
              <input type="date" style={S.inp}
                value={addInvForm.purchaseDate}
                onChange={e => setAddInvForm(p => ({ ...p, purchaseDate: e.target.value }))} />
            </FField>
          </FRow>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <CBtn color="#10B981" onClick={saveAsset} disabled={!addInvForm.shares || !addInvForm.buyPrice}>
              ✓ Ajouter dans l'enveloppe
            </CBtn>
            <button onClick={() => { resetAddInv(); close(); }} style={S.btnS}>Annuler</button>
          </div>
        </CMShell>
      );
    }

    // ── Step 1: choix de l'enveloppe ──────────────────────────────────────────
    if (addInvStep === 1 && addInvAsset) {
      const envs       = compatEnvs(addInvAsset);
      const ticker     = addInvAsset._kind === 'commodity' ? addInvAsset.ticker : (addInvAsset.symbol || addInvAsset.id || '');
      const defEnvType = addInvAsset._kind === 'crypto' ? 'Crypto' : addInvAsset._kind === 'commodity' ? 'Matières premières' : 'CTO';
      return (
        <CMShell T={T} title="Dans quelle enveloppe ?" icon="🏦" color="#10B981"
          onClose={() => { resetAddInv(); close(); }} maxWidth={520}>
          <button onClick={() => { setAddInvStep(0); setAddInvAsset(null); }}
            style={{ ...S.btnS, fontSize: 12, marginBottom: 16 }}>← Retour</button>
          <div style={{ fontSize: 13, color: T.text, marginBottom: 16 }}>
            Ajout de <span style={{ fontWeight: 700 }}>{addInvAsset.name}</span>
            {ticker && <span style={{ color: T.textMuted }}> ({ticker})</span>}
          </div>
          {envs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {envs.map(inv => {
                const ic = PORTFOLIO_TYPE_ICON[inv.type] || '📦';
                const cc = PORTFOLIO_MODAL_COLOR[inv.type] || '#94A3B8';
                return (
                  <button key={inv.id} onClick={() => selectEnv(inv.id, ticker)}
                    style={{ background: T.bg2, border: `1px solid ${cc}30`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.background = cc + '18'; e.currentTarget.style.borderColor = cc + '60'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.borderColor = cc + '30'; }}>
                    <span style={{ fontSize: 20 }}>{ic}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{inv.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{inv.type}</div>
                    </div>
                    <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 16 }}>
              Aucune enveloppe compatible. Créez-en une d'abord.
            </div>
          )}
          <button
            onClick={() => {
              addInvPendingAssetRef.current = addInvAsset;
              invCountRef.current = (investments || []).length;
              setPortfolioForm({ ...mkPortfolio(), type: defEnvType });
              setModal('portfolio');
            }}
            style={{ ...S.btnG, fontSize: 12, padding: '8px 16px' }}>
            + Créer une nouvelle enveloppe
          </button>
        </CMShell>
      );
    }

    // ── Step 0: recherche + grille de catégories ──────────────────────────────
    const qLow   = addInvSearch.toLowerCase();
    const qWords = qLow.split(/[\s,]+/).filter(Boolean);
    const commodityMatches = addInvSearch.length >= 2
      ? COMMODITY_KEYWORDS.filter(c => c.keywords.some(kw => qWords.includes(kw)))
          .map(c => ({ _kind: 'commodity', name: c.name, ticker: c.ticker, commodityType: c.commodityType, icon: c.icon }))
      : [];
    const qNorm = normalizeStr(addInvSearch);
    const scpiMatches = addInvSearch.length >= 2
      ? SCPI_LIST.filter(s => normalizeStr(s).includes(qNorm)).map(s => ({ _kind: 'scpi', name: s }))
      : [];
    const apiStocks  = addInvResults.filter(r => r._kind === 'stock');
    const apiCryptos = addInvResults.filter(r => r._kind === 'crypto');
    const localCryptoHits = addInvSearch.length >= 2
      ? CRYPTO_LOCAL.filter(c => c.name.toLowerCase().includes(qLow) || c.symbol.toLowerCase().includes(qLow))
          .map(c => ({ ...c, _kind: 'crypto' }))
      : [];
    const cryptosToShow = !addInvLoading && apiCryptos.length === 0 ? localCryptoHits : apiCryptos;
    const hasAnyResult  = (filteredTypes?.length ?? 0) > 0 || commodityMatches.length > 0
      || scpiMatches.length > 0 || apiStocks.length > 0 || cryptosToShow.length > 0;
    const showFallback  = !addInvLoading && addInvSearch.length >= 2 && !hasAnyResult;

    const renderAssetRow = (asset, key) => {
      const isCom = asset._kind === 'commodity';
      const isSc  = asset._kind === 'scpi';
      const isCr  = asset._kind === 'crypto';
      const badgeColor = isCom ? '#EAB308' : isSc ? '#D97706' : isCr ? '#F59E0B' : '#60A5FA';
      const badgeText  = isCom ? 'MATIÈRE 1ÈRE' : isSc ? 'SCPI' : isCr ? 'Crypto' : (asset.type === 'ETF' ? 'ETF' : 'Action');
      const onClick = isSc ? () => selectScpi(asset.name) : () => { setAddInvAsset(asset); setAddInvStep(1); };
      const logoNode = isCom
        ? <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EAB30818', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{asset.icon}</div>
        : isCr
          ? <AssetLogo sources={asset.thumb ? [asset.thumb] : []} letter={(asset.symbol || '?')[0]} color="#F59E0B" />
          : isSc
            ? <AssetLogo sources={scpiLogoSources(asset.name)} letter="🏬" color="#D97706" />
            : <AssetLogo sources={stockLogoSources(asset.symbol, asset.logoUrl)} letter={(asset.symbol || '?').split('.')[0][0]} color="#60A5FA" />;
      return (
        <button key={key} onClick={onClick}
          style={{ background: T.bg2, border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', marginBottom: 4 }}
          onMouseEnter={e => e.currentTarget.style.background = T.bg3}
          onMouseLeave={e => e.currentTarget.style.background = T.bg2}>
          {logoNode}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>
              {isCom ? asset.ticker : isSc ? 'Pierre-papier' : `${asset.symbol || asset.id}${asset.exchange ? ` · ${asset.exchange}` : ''}`}
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: badgeColor + '22', color: badgeColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {badgeText}
          </span>
        </button>
      );
    };

    return (
      <CMShell T={T} title="Ajouter un investissement" icon="✨" color="#10B981"
        onClose={() => { resetAddInv(); close(); }} maxWidth={640}>
        <input autoFocus type="text" placeholder="Nom, ticker, ISIN ou type d'enveloppe…"
          value={addInvSearch} onChange={e => onSearchChange(e.target.value)}
          style={{ ...S.inp, marginBottom: 16, fontSize: 14 }} />

        {addInvSearch.length >= 2 ? (
          <div>
            {/* 1. Enveloppes filtrées */}
            {filteredTypes.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={secLabel}>Types d'enveloppe</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {filteredTypes.map(renderTile)}
                </div>
              </div>
            )}
            {/* 2. Matières premières */}
            {commodityMatches.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={secLabel}>Matières premières</div>
                {commodityMatches.map((a, i) => renderAssetRow(a, `com-${i}`))}
              </div>
            )}
            {/* 3. SCPI */}
            {scpiMatches.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={secLabel}>SCPI</div>
                {scpiMatches.map((a, i) => renderAssetRow(a, `scpi-${i}`))}
              </div>
            )}
            {/* 4+5. API results */}
            {addInvLoading ? (
              <div style={{ color: T.textMuted, fontSize: 12, textAlign: 'center', padding: '10px 0' }}>Recherche…</div>
            ) : (
              <>
                {apiStocks.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={secLabel}>Actions & ETF</div>
                    {apiStocks.map((a, i) => renderAssetRow(a, `stock-${i}`))}
                  </div>
                )}
                {cryptosToShow.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={secLabel}>Crypto</div>
                    {cryptosToShow.map((a, i) => renderAssetRow(a, `crypto-${i}`))}
                  </div>
                )}
              </>
            )}
            {/* 6. Fallback */}
            {showFallback && (
              <div style={{ textAlign: 'center', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 10 }}>Vous ne trouvez pas ce que vous cherchez ?</div>
                <button onClick={() => onSearchChange('')} style={{ ...S.btnG, fontSize: 12, padding: '8px 18px' }}>
                  Ajouter manuellement
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {INVEST_GROUPS.map(g => (
              <div key={g.label}>
                <div style={secLabel}>{g.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {g.types.map(renderTile)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CMShell>
    );
  }

  // ── Enveloppe d'investissement ────────────────────────────────────────────────
  if (modal === 'portfolio') {
    const pt   = portfolioForm.type;
    const c    = PORTFOLIO_MODAL_COLOR[pt] || '#94A3B8';
    const icon = PORTFOLIO_TYPE_ICON[pt] || '📦';
    const f    = fa(c);
    const isAV        = pt === 'Assurance-vie';
    const isCrypto    = pt === 'Crypto';
    const isImmo      = pt === 'Immobilier';
    const isPE        = pt === 'Épargne salariale';
    const isPEA       = pt === 'PEA';
    const isCTO       = pt === 'CTO';
    const isRealT     = pt === 'RealT';
    const isMP        = pt === 'Matières premières';
    const isCrowdImmo = ['La Première Brique', 'Tantiem', 'Bricks.co', 'Crowdfunding immobilier'].includes(pt);
    const isSCPI      = ['SCPI', 'OPCI', 'SCI'].includes(pt);
    const isPE2       = ['Private Equity', 'Crowdfunding entreprise'].includes(pt);
    const isOblig     = pt === 'Obligations';
    const isAltInvest = ['Art & Collections', 'Forêts / GFI', 'Vignes / GFV'].includes(pt);
    const isPER       = pt === 'PER';
    const isAVFE      = pt === 'Assurance-vie fonds euros';
    const isAutre     = pt === 'Autre';
    const closePortfolio = () => close(() => { setPortfolioForm(mkPortfolio()); resetRealt(); });
    const importRealtAll = () => {
      if (!realtTokens?.length) return;
      const a = realtAddr.trim();
      const shortAddr = `${a.slice(0, 6)}…${a.slice(-4)}`;
      const newInv = {
        id: uid(), name: `RealT ${shortAddr}`, type: 'RealT', color: '#ef4444',
        platform: a, walletType: '', courtier: '', openDate: '', devise: 'EUR',
        assureur: '', avType: '', immoBien: '', adresse: '', acquisitionDate: '',
        loanId: '', loyerMensuel: 0, chargesMensuelles: 0, employeur: '', peType: '',
        disponibiliteDate: '', value: 0, invested: 0, notes: '', cash: 0,
        positions: realtTokens.map(tk => {
          const price = tk.needsManualPrice
            ? (parseFloat(realtManualPrices[tk.contractAddress] || '0') || 0)
            : (tk.priceEUR || 0);
          return {
            id: uid(), ticker: tk.symbol, name: tk.name,
            shares: tk.amount, buyPrice: price, currentPrice: price,
            posType: 'other', divYield: tk.annualYield || 0,
            isin: '', exchange: '', currency: 'EUR', platform: '', notes: '', commodityType: '',
          };
        }),
        dividends: [],
      };
      setInvestments(prev => [...(prev || []), newInv]);
      closePortfolio();
    };
    return (
      <CMShell T={T} title={editItem ? t('modal_portfolio_edit') : t('modal_portfolio_new')} icon={icon} color={c} onClose={closePortfolio}>
        {/* ── Nom + Type ────────────────────────────────────────────────────── */}
        <FRow cols={2}>
          <FField style={f} label={t('portfolio_name')}><input type="text" placeholder="Ex : PEA Boursorama, Crypto Binance…" style={S.inp} value={portfolioForm.name} onChange={e => setPortfolioForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label={t('portfolio_type')}>
            <select style={S.inp} value={portfolioForm.type} onChange={e => {
              const newType = e.target.value;
              const autoPlat = ['La Première Brique', 'Tantiem', 'Bricks.co'].includes(newType) ? newType : portfolioForm.platform;
              setPortfolioForm(p => ({ ...p, type: newType, platform: autoPlat }));
            }}>
              {PORTFOLIO_TYPES.map(pt2 => <option key={pt2} value={pt2}>{PORTFOLIO_TYPE_ICON[pt2]} {pt2}</option>)}
            </select>
          </FField>
        </FRow>

        {/* ── PEA / CTO ─────────────────────────────────────────────────────── */}
        {(isPEA || isCTO) && (
          <FRow cols={2}>
            <FField style={f} label={t('portfolio_courtier')}>
              <select style={S.inp} value={portfolioForm.courtier} onChange={e => setPortfolioForm(p => ({ ...p, courtier: e.target.value }))}>
                <option value="">{t('tx_select')}</option>
                {(isPEA ? PORTFOLIO_BROKERS_PEA : PORTFOLIO_BROKERS_CTO).map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label={t('portfolio_open_date')}><input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} /></FField>
          </FRow>
        )}
        {isPEA && portfolioForm.openDate && (() => {
          const open = new Date(portfolioForm.openDate);
          const fiveY = new Date(open.getFullYear() + 5, open.getMonth(), open.getDate());
          const passed = new Date() >= fiveY;
          const dateStr = fiveY.toLocaleDateString('fr-FR');
          return <div style={{ background: passed ? 'rgba(16,185,129,.08)' : 'rgba(96,165,250,.08)', border: `1px solid ${passed ? 'rgba(16,185,129,.2)' : 'rgba(96,165,250,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: passed ? '#4ade80' : '#60a5fa' }}>{passed ? t('portfolio_pea_tax_ok') : t('portfolio_pea_tax_wait', dateStr)}</div>;
        })()}

        {/* ── Assurance-vie ─────────────────────────────────────────────────── */}
        {isAV && (
          <FRow cols={2}>
            <FField style={f} label={t('portfolio_courtier')}>
              <select style={S.inp} value={portfolioForm.assureur} onChange={e => setPortfolioForm(p => ({ ...p, assureur: e.target.value }))}>
                <option value="">{t('tx_select')}</option>
                {PORTFOLIO_AV_INSURERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label={t('portfolio_contract_type')}>
              <select style={S.inp} value={portfolioForm.avType} onChange={e => setPortfolioForm(p => ({ ...p, avType: e.target.value }))}>
                {PORTFOLIO_AV_TYPES.map(avt => <option key={avt}>{avt}</option>)}
              </select>
            </FField>
          </FRow>
        )}
        {isAV && (
          <FRow cols={1}>
            <FField style={f} label={t('portfolio_open_date')}><input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} /></FField>
          </FRow>
        )}
        {isAV && portfolioForm.openDate && (() => {
          const open = new Date(portfolioForm.openDate);
          const eightY = new Date(open.getFullYear() + 8, open.getMonth(), open.getDate());
          const passed = new Date() >= eightY;
          const avDateStr = eightY.toLocaleDateString('fr-FR');
          return <div style={{ background: passed ? 'rgba(16,185,129,.08)' : 'rgba(96,165,250,.08)', border: `1px solid ${passed ? 'rgba(16,185,129,.2)' : 'rgba(96,165,250,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: passed ? '#4ade80' : '#60a5fa' }}>{passed ? t('portfolio_av_tax_ok') : t('portfolio_av_tax_wait', avDateStr)}</div>;
        })()}

        {/* ── Crypto ────────────────────────────────────────────────────────── */}
        {isCrypto && (
          <FRow cols={2}>
            <FField style={f} label={t('portfolio_platform')}>
              <select style={S.inp} value={portfolioForm.platform} onChange={e => setPortfolioForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="">{t('tx_select')}</option>
                {PORTFOLIO_CRYPTO_PLATFORMS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label={t('portfolio_wallet_type')}>
              <select style={S.inp} value={portfolioForm.walletType} onChange={e => setPortfolioForm(p => ({ ...p, walletType: e.target.value }))}>
                {PORTFOLIO_CRYPTO_TYPES.map(wt => <option key={wt}>{wt}</option>)}
              </select>
            </FField>
          </FRow>
        )}

        {/* ── Matières premières ────────────────────────────────────────────── */}
        {isMP && (
          <FRow cols={1}>
            <FField style={f} label="Lieu de stockage">
              <select style={S.inp} value={portfolioForm.adresse} onChange={e => setPortfolioForm(p => ({ ...p, adresse: e.target.value }))}>
                {['Coffre bancaire', 'Domicile', 'Entrepôt sécurisé', 'Autre'].map(s => <option key={s}>{s}</option>)}
              </select>
            </FField>
          </FRow>
        )}

        {/* ── Immobilier physique — contenant uniquement ────────────────────── */}
        {isImmo && (
          <>
            <FRow cols={2}>
              <FField style={f} label={t('portfolio_immo_type')}>
                <select style={S.inp} value={portfolioForm.immoBien} onChange={e => setPortfolioForm(p => ({ ...p, immoBien: e.target.value }))}>
                  {PORTFOLIO_IMMO_TYPES.map(it => <option key={it}>{it}</option>)}
                </select>
              </FField>
              <FField style={f} label={t('portfolio_acq_date')}><input type="date" style={S.inp} value={portfolioForm.acquisitionDate} onChange={e => setPortfolioForm(p => ({ ...p, acquisitionDate: e.target.value }))} /></FField>
            </FRow>
            <FRow cols={1}>
              <FField style={f} label={`${t('portfolio_address')} (optionnel)`}><input type="text" placeholder="12 rue des Lilas, 75011 Paris" style={S.inp} value={portfolioForm.adresse} onChange={e => setPortfolioForm(p => ({ ...p, adresse: e.target.value }))} /></FField>
            </FRow>
          </>
        )}

        {/* ── Crowdfunding immobilier (LPB, Tantiem, Bricks…) ─────────────── */}
        {isCrowdImmo && (
          <FRow cols={2}>
            <FField style={f} label="Plateforme">
              <input type="text" placeholder="Ex : Homunity, Anaxago, Fundimmo…" style={S.inp} value={portfolioForm.platform} onChange={e => setPortfolioForm(p => ({ ...p, platform: e.target.value }))} />
            </FField>
            <FField style={f} label="Date d'investissement (optionnel)">
              <input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} />
            </FField>
          </FRow>
        )}

        {/* ── SCPI / OPCI / SCI ────────────────────────────────────────────── */}
        {isSCPI && (
          <>
            <FRow cols={2}>
              <FField style={f} label="Société de gestion">
                <input type="text" placeholder="Ex : CORUM, Perial, La Française…" style={S.inp} value={portfolioForm.courtier} onChange={e => setPortfolioForm(p => ({ ...p, courtier: e.target.value }))} />
              </FField>
              <FField style={f} label="Nom du fonds">
                <input type="text" placeholder="Ex : CORUM Origin, PFO2…" style={S.inp} value={portfolioForm.adresse} onChange={e => setPortfolioForm(p => ({ ...p, adresse: e.target.value }))} />
              </FField>
            </FRow>
            <FRow cols={1}>
              <FField style={f} label="Date de souscription (optionnel)">
                <input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} />
              </FField>
            </FRow>
          </>
        )}

        {/* ── Private Equity / Crowdfunding entreprise ─────────────────────── */}
        {isPE2 && (
          <FRow cols={2}>
            <FField style={f} label="Plateforme">
              <input type="text" placeholder="Ex : Eurazeo, Bpifrance, Wiseed…" style={S.inp} value={portfolioForm.courtier} onChange={e => setPortfolioForm(p => ({ ...p, courtier: e.target.value }))} />
            </FField>
            <FField style={f} label="Nom du fonds / projet">
              <input type="text" placeholder="Ex : Altaroc Odyssey 2023…" style={S.inp} value={portfolioForm.adresse} onChange={e => setPortfolioForm(p => ({ ...p, adresse: e.target.value }))} />
            </FField>
          </FRow>
        )}

        {/* ── Obligations ──────────────────────────────────────────────────── */}
        {isOblig && (
          <FRow cols={2}>
            <FField style={f} label="Émetteur">
              <input type="text" placeholder="Ex : OAT France, Total, LVMH…" style={S.inp} value={portfolioForm.courtier} onChange={e => setPortfolioForm(p => ({ ...p, courtier: e.target.value }))} />
            </FField>
            <FField style={f} label="Type">
              <select style={S.inp} value={portfolioForm.avType} onChange={e => setPortfolioForm(p => ({ ...p, avType: e.target.value }))}>
                {['État', 'Corporate', 'Convertible', 'High Yield'].map(bt => <option key={bt}>{bt}</option>)}
              </select>
            </FField>
          </FRow>
        )}

        {/* ── Art / Forêts / Vignes ────────────────────────────────────────── */}
        {isAltInvest && (
          <FRow cols={1}>
            <FField style={f} label="Description courte (optionnel)">
              <input type="text" placeholder="Ex : Tableau signé Dupont, Part de forêt en Normandie…" style={S.inp} value={portfolioForm.notes} onChange={e => setPortfolioForm(p => ({ ...p, notes: e.target.value }))} />
            </FField>
          </FRow>
        )}

        {/* ── PER ──────────────────────────────────────────────────────────── */}
        {isPER && (
          <FRow cols={2}>
            <FField style={f} label="Établissement">
              <input type="text" placeholder="Ex : Linxea, Yomoni, Generali…" style={S.inp} value={portfolioForm.courtier} onChange={e => setPortfolioForm(p => ({ ...p, courtier: e.target.value }))} />
            </FField>
            <FField style={f} label="Date d'ouverture (optionnel)">
              <input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} />
            </FField>
          </FRow>
        )}

        {/* ── Assurance-vie fonds euros ─────────────────────────────────────── */}
        {isAVFE && (
          <FRow cols={2}>
            <FField style={f} label="Assureur">
              <select style={S.inp} value={portfolioForm.assureur} onChange={e => setPortfolioForm(p => ({ ...p, assureur: e.target.value }))}>
                <option value="">{t('tx_select')}</option>
                {PORTFOLIO_AV_INSURERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label="Date d'ouverture (optionnel)">
              <input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} />
            </FField>
          </FRow>
        )}

        {/* ── Épargne salariale ────────────────────────────────────────────── */}
        {isPE && (
          <>
            <FRow cols={2}>
              <FField style={f} label={t('portfolio_employer')}><input type="text" placeholder="Nom de l'entreprise" style={S.inp} value={portfolioForm.employeur} onChange={e => setPortfolioForm(p => ({ ...p, employeur: e.target.value }))} /></FField>
              <FField style={f} label={t('portfolio_plan_type')}>
                <select style={S.inp} value={portfolioForm.peType} onChange={e => setPortfolioForm(p => ({ ...p, peType: e.target.value }))}>
                  {PORTFOLIO_PE_TYPES.map(pet => <option key={pet}>{pet}</option>)}
                </select>
              </FField>
            </FRow>
            <FRow cols={1}>
              <FField style={f} label={t('portfolio_open_date')}><input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} /></FField>
            </FRow>
          </>
        )}

        {/* ── Autre ────────────────────────────────────────────────────────── */}
        {isAutre && (
          <FRow cols={1}>
            <FField style={f} label="Description (optionnel)">
              <input type="text" placeholder="Décrivez cet actif…" style={S.inp} value={portfolioForm.notes} onChange={e => setPortfolioForm(p => ({ ...p, notes: e.target.value }))} />
            </FField>
          </FRow>
        )}

        {/* ── RealT wallet import ───────────────────────────────────────────── */}
        {isRealT && (
          <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Import wallet Ethereum</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" placeholder="0x1234...abcd" style={{ ...S.inp, flex: 1 }} value={realtAddr}
                onChange={e => setRealtAddr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !realtLoading && searchRealt()}
              />
              <CBtn color="#EF4444" onClick={searchRealt} disabled={realtLoading || !realtAddr.trim()}>
                {realtLoading ? '…' : 'Rechercher'}
              </CBtn>
            </div>
            {realtErr && <div style={{ color: '#f87171', fontSize: 11 }}>{realtErr}</div>}
            {realtTokens !== null && realtTokens.length === 0 && !realtErr && (
              <div style={{ color: T.textMuted, fontSize: 12, textAlign: 'center' }}>Aucun token trouvé.</div>
            )}
            {realtTokens && realtTokens.length > 0 && (() => {
              const totalEUR = realtTokens.reduce((s, tk) => {
                if (!tk.needsManualPrice) return s + (tk.totalEUR || 0);
                const mp = parseFloat(realtManualPrices[tk.contractAddress] || '0');
                return s + (mp > 0 ? tk.amount * mp : 0);
              }, 0);
              const needsPriceCount = realtTokens.filter(tk => tk.needsManualPrice).length;
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: T.textMuted }}>
                      {realtTokens.length} token{realtTokens.length > 1 ? 's' : ''} trouvé{realtTokens.length > 1 ? 's' : ''}
                      {needsPriceCount > 0 && <span style={{ color: '#fb923c' }}> · {needsPriceCount} sans prix auto</span>}
                    </span>
                    <span style={{ color: '#EF4444', fontWeight: 600 }}>{fEur(totalEUR)}</span>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {realtTokens.map((tk, i) => (
                      <div key={i} style={{ padding: '7px 10px', background: T.bg2, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.name}</div>
                          <div style={{ fontSize: 10, color: T.textMuted }}>
                            {+parseFloat(tk.amount).toFixed(4)} tok
                            {tk.annualYield > 0 && <span style={{ color: '#4ade80' }}> · {tk.annualYield.toFixed(2)}%/an</span>}
                          </div>
                        </div>
                        {tk.needsManualPrice ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <input
                              type="number" min="0" step="0.01" placeholder="Prix €"
                              style={{ ...S.inp, width: 72, fontSize: 11, padding: '3px 6px', textAlign: 'right' }}
                              value={realtManualPrices[tk.contractAddress] || ''}
                              onChange={e => setRealtManualPrices(p => ({ ...p, [tk.contractAddress]: e.target.value }))}
                            />
                            <span style={{ fontSize: 10, color: T.textMuted }}>/tok</span>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fEur(tk.totalEUR)}</div>
                            <div style={{ fontSize: 10, color: T.textMuted }}>{fEur(tk.priceEUR)}/tok</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {isRealT && realtTokens?.length > 0
            ? <CBtn color="#EF4444" onClick={importRealtAll}>✓ Importer {realtTokens.length} token{realtTokens.length > 1 ? 's' : ''}</CBtn>
            : <CBtn color={c} onClick={savePortfolio} disabled={!portfolioForm.name || (isRealT && !realtTokens)}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          }
          <button onClick={closePortfolio} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Patrimoine matériel ──────────────────────────────────────────────────────
  if (modal === 'health') {
    const c = '#F87171';
    const f = fa(c);
    const usedCats = [...new Set([...HEALTH_CATS, ...(listings.map(l => l.category)), ...(soldHistory.map(l => l.category))].filter(Boolean))];
    return (
      <CMShell T={T} title={editItem ? t('modal_health_edit') : t('modal_health_new')} icon="📦" color={c} onClose={() => close(() => setHealthForm(mkHealth()))}>
        <FRow cols={2}>
          <FField style={f} label={t('f_name')}><input type="text" placeholder="Ex : Renault Clio, Collection…" style={S.inp} value={healthForm.name} onChange={e => setHealthForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label={t('f_category')}>
            <input type="text" list="health-cats-list" placeholder="Ex : Voiture, Collection…" style={S.inp} value={healthForm.category} onChange={e => setHealthForm(p => ({ ...p, category: e.target.value }))} />
            <datalist id="health-cats-list">{usedCats.map(cc => <option key={cc} value={cc} />)}</datalist>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('health_buy_price')}><input type="number" placeholder="0" style={S.inp} value={healthForm.buyPrice} onChange={e => setHealthForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
          <FField style={f} label={t('health_current_value')}><input type="number" placeholder="0" style={S.inp} value={healthForm.currentValue} onChange={e => setHealthForm(p => ({ ...p, currentValue: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('health_condition')}>
            <select style={S.inp} value={healthForm.condition || 'Bon état'} onChange={e => setHealthForm(p => ({ ...p, condition: e.target.value }))}>
              {ITEM_CONDITIONS.map(cc => <option key={cc}>{cc}</option>)}
            </select>
          </FField>
          <FField style={f} label={t('health_storage')}><input type="text" placeholder="Ex : Garage, Cave…" style={S.inp} value={healthForm.storageLocation || ''} onChange={e => setHealthForm(p => ({ ...p, storageLocation: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('health_acq_date')}><input type="date" style={S.inp} value={healthForm.date} onChange={e => setHealthForm(p => ({ ...p, date: e.target.value }))} /></FField>
          <FField style={f} label={t('f_notes')}><input type="text" placeholder={t('f_remark')} style={S.inp} value={healthForm.notes} onChange={e => setHealthForm(p => ({ ...p, notes: e.target.value }))} /></FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveHealth}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setHealthForm(mkHealth()))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Objectif ──────────────────────────────────────────────────────────────────
  if (modal === 'goal') {
    const c = goalForm.color || '#10B981';
    const f = fa(c);
    return (
      <CMShell T={T} title={editItem ? t('modal_goal_edit') : t('modal_goal_new')} icon="🎯" color={c} onClose={() => close(() => setGoalForm({}))}>
        <FRow cols={1}>
          <FField style={f} label={t('goal_name')}><input type="text" placeholder="Ex : Indépendance financière" style={S.inp} value={goalForm.name || ''} onChange={e => setGoalForm(p => ({ ...p, name: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('goal_target_amount')}><input type="number" placeholder="0" style={S.inp} value={goalForm.target || ''} onChange={e => setGoalForm(p => ({ ...p, target: e.target.value }))} /></FField>
          <FField style={f} label={t('goal_deadline')}><input type="date" style={S.inp} value={goalForm.deadline || ''} onChange={e => setGoalForm(p => ({ ...p, deadline: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={1}>
          <FField style={f} label={t('f_color')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
              {['#10b981','#60a5fa','#f59e0b','#f472b6','#a78bfa','#fb923c','#34d399','#f87171'].map(col => (
                <button key={col} onClick={() => setGoalForm(p => ({ ...p, color: col }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: col, border: goalForm.color === col ? `3px solid #fff` : '3px solid transparent', cursor: 'pointer', padding: 0, outline: 'none' }} />
              ))}
            </div>
          </FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveGoal}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setGoalForm({}))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Épargne & Cash ───────────────────────────────────────────────────────────
  if (modal === 'cash') {
    const c = '#34D399';
    const f = fa(c);
    return (
      <CMShell T={T} title={editItem ? t('modal_cash_edit') : t('modal_cash_new')} icon="💰" color={c} onClose={() => close(() => setCashForm(mkCash()))}>
        <FRow cols={2}>
          <FField style={f} label={t('cash_account_name')}><input type="text" placeholder="Ex : Livret A CA" style={S.inp} value={cashForm.name} onChange={e => setCashForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label={t('f_type')}>
            <select style={S.inp} value={cashForm.type} onChange={e => {
              const info = CASH_TYPE_INFO[e.target.value] || {};
              setCashForm(p => ({ ...p, type: e.target.value, rate: info.rate != null ? info.rate : p.rate }));
            }}>
              {CASH_TYPES.map(ct => <option key={ct}>{ct}</option>)}
            </select>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('cash_balance')}><input type="number" placeholder="0" style={S.inp} value={cashForm.balance} onChange={e => setCashForm(p => ({ ...p, balance: e.target.value }))} /></FField>
          <FField style={f} label={t('cash_rate')}><input type="number" placeholder="0" step="0.01" style={S.inp} value={cashForm.rate} onChange={e => setCashForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        {(() => {
          const info = CASH_TYPE_INFO[cashForm.type] || {};
          const bal = parseFloat(cashForm.balance) || 0;
          const cap = info.cap;
          const overCap = cap != null && bal > cap;
          const remaining = cap != null ? cap - bal : null;
          return (
            <>
              {bal > 0 && cashForm.rate > 0 && (
                <div style={{ background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12, color: '#4ade80' }}>
                  {t('cash_annual_interests', fEur(bal * parseFloat(cashForm.rate) / 100))}
                </div>
              )}
              {cap != null && (
                <div style={{ background: overCap ? 'rgba(248,113,113,.08)' : 'rgba(96,165,250,.08)', border: `1px solid ${overCap ? 'rgba(248,113,113,.3)' : 'rgba(96,165,250,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: overCap ? '#f87171' : '#60a5fa' }}>{t('cash_cap_regulatory', fEur(cap))}</span>
                    {overCap && <span style={{ color: '#f87171', fontWeight: 700 }}>{t('cash_cap_exceeded_badge')}</span>}
                  </div>
                  {!overCap && remaining != null && <span style={{ color: '#94a3b8' }}>{t('cash_capacity_remaining', fEur(remaining))}</span>}
                </div>
              )}
            </>
          );
        })()}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveCash}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setCashForm(mkCash()))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Article en vente ──────────────────────────────────────────────────────────
  if (modal === 'listing') {
    const c = '#A78BFA';
    const f = fa(c);
    const usedCats      = [...new Set([...listings.map(l => l.category), ...soldHistory.map(l => l.category)].filter(Boolean))];
    const usedPlatforms = [...new Set([...listings.map(l => l.platform), ...soldHistory.map(l => l.platform)].filter(Boolean))];
    return (
      <CMShell T={T} title={editItem ? t('modal_listing_edit') : t('modal_listing_new')} icon="🏷️" color={c} onClose={() => close(() => setListingForm(mkListing()))}>
        <FRow cols={2}>
          <FField style={f} label={t('f_name')}><input type="text" placeholder="Ex : iPhone 13 Pro" style={S.inp} value={listingForm.name} onChange={e => setListingForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label={t('f_category')}>
            <input type="text" list="listing-cats-list" placeholder="Ex : Électronique, Vêtements…" style={S.inp} value={listingForm.category} onChange={e => setListingForm(p => ({ ...p, category: e.target.value }))} />
            <datalist id="listing-cats-list">{usedCats.map(cc => <option key={cc} value={cc} />)}</datalist>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('listing_platform')}>
            <input type="text" list="listing-platforms-list" placeholder="Ex : eBay, Vinted, LeBonCoin…" style={S.inp} value={listingForm.platform} onChange={e => setListingForm(p => ({ ...p, platform: e.target.value }))} />
            <datalist id="listing-platforms-list">{usedPlatforms.map(pl => <option key={pl} value={pl} />)}</datalist>
          </FField>
          <FField style={f} label={t('listing_listed_date')}><input type="date" style={S.inp} value={listingForm.listedDate} onChange={e => setListingForm(p => ({ ...p, listedDate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('health_condition')}>
            <select style={S.inp} value={listingForm.condition || 'Bon état'} onChange={e => setListingForm(p => ({ ...p, condition: e.target.value }))}>
              {ITEM_CONDITIONS.map(cc => <option key={cc}>{cc}</option>)}
            </select>
          </FField>
          <FField style={f} label={t('health_storage')}><input type="text" placeholder="Ex : Cave, Garage…" style={S.inp} value={listingForm.storageLocation || ''} onChange={e => setListingForm(p => ({ ...p, storageLocation: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField style={f} label={t('listing_buy_price')}><input type="number" placeholder="0" style={S.inp} value={listingForm.buyPrice} onChange={e => setListingForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
          <FField style={f} label={t('listing_sell_price')}><input type="number" placeholder="0" style={S.inp} value={listingForm.sellPrice} onChange={e => setListingForm(p => ({ ...p, sellPrice: e.target.value }))} /></FField>
          <FField style={f} label={t('listing_fees')}><input type="number" placeholder="0" style={S.inp} value={listingForm.fees} onChange={e => setListingForm(p => ({ ...p, fees: e.target.value }))} /></FField>
        </FRow>
        {listingForm.buyPrice !== '' && listingForm.sellPrice !== '' && (() => {
          const profit = parseFloat(listingForm.sellPrice || 0) - parseFloat(listingForm.buyPrice || 0) - parseFloat(listingForm.fees || 0);
          return (
            <div style={{ background: profit >= 0 ? 'rgba(16,185,129,.08)' : 'rgba(248,113,113,.08)', border: `1px solid ${profit >= 0 ? 'rgba(16,185,129,.2)' : 'rgba(248,113,113,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12, color: profit >= 0 ? '#4ade80' : '#f87171' }}>
              {profit >= 0 ? '💰' : '⚠️'} {t('listing_profit_label')} : <strong>{profit >= 0 ? '+' : ''}{fEur(profit)}</strong>
            </div>
          );
        })()}
        <FRow cols={1}>
          <FField style={f} label={t('f_notes')}><input type="text" placeholder={t('f_remark')} style={S.inp} value={listingForm.notes} onChange={e => setListingForm(p => ({ ...p, notes: e.target.value }))} /></FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveListing}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setListingForm(mkListing()))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Dividende ─────────────────────────────────────────────────────────────────
  if (modal === 'div') {
    const c   = '#10B981';
    const f   = fa(c);
    const inv = investments.find(i => i.id === divInvId);
    const closeDiv = () => { setModal(null); setDivForm({ date: today(), amount: '', gross: true, note: '' }); setConfirmDel(null); };
    const ConfirmDialog = () => confirmDel ? (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: T.bg3, border: '1px solid rgba(248,113,113,.35)', borderRadius: 16, padding: '26px 28px', maxWidth: 380, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10, textAlign: 'center' }}>Confirmer la suppression</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 22, textAlign: 'center', lineHeight: 1.55 }}>{confirmDel.msg}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setConfirmDel(null)} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: T.textMuted, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            <button onClick={() => { confirmDel.fn(); setConfirmDel(null); }} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
          </div>
        </div>
      </div>
    ) : null;
    return (
      <>
      <CMShell T={T} title={`${t('modal_div_title')} — ${inv?.name || ''}`} icon="💸" color={c} onClose={closeDiv}>
        <FRow cols={2}>
          <FField style={f} label={t('div_date')}><input type="date" style={S.inp} value={divForm.date} onChange={e => setDivForm(p => ({ ...p, date: e.target.value }))} /></FField>
          <FField style={f} label={t('div_amount')}><input type="number" placeholder="0.00" step="0.01" style={S.inp} value={divForm.amount} onChange={e => setDivForm(p => ({ ...p, amount: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('div_gross')}>
            <select style={S.inp} value={divForm.gross ? 'brut' : 'net'} onChange={e => setDivForm(p => ({ ...p, gross: e.target.value === 'brut' }))}>
              <option value="brut">{t('div_gross_option')}</option>
              <option value="net">{t('div_net_option')}</option>
            </select>
          </FField>
          <FField style={f} label={t('div_note')}><input type="text" placeholder="Ex : Dividende trimestriel" style={S.inp} value={divForm.note} onChange={e => setDivForm(p => ({ ...p, note: e.target.value }))} /></FField>
        </FRow>
        {divForm.amount && parseFloat(divForm.amount) > 0 && (
          <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#4ade80' }}>
            {divForm.gross ? t('div_net_est', fEur(parseFloat(divForm.amount) * 0.7)) : t('div_gross_est', fEur(parseFloat(divForm.amount) / 0.7))}
          </div>
        )}
        {inv?.dividends?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('div_history', inv.dividends.length)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
              {[...inv.dividends].sort((a, b) => b.date.localeCompare(a.date)).map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: T.bg2, borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: T.textMuted }}>{fDate(d.date)}{d.note ? ` · ${d.note}` : ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>+{fEur(d.amount)}</span>
                    <span style={{ fontSize: 10, color: d.gross ? '#fb923c' : '#a78bfa', background: d.gross ? 'rgba(251,146,60,.12)' : 'rgba(167,139,250,.12)', padding: '1px 6px', borderRadius: 4 }}>{d.gross ? t('gross') : t('net')}</span>
                    <button onClick={() => setConfirmDel({ msg: `Supprimer ce dividende de ${fEur(d.amount)} ? Cette action est irréversible.`, fn: () => data.delDividend(divInvId, d.id) })} style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <CBtn color={c} onClick={() => { addDividend(divInvId, divForm); setDivForm(p => ({ ...p, amount: '', note: '' })); }} disabled={!divForm.amount}>{t('btn_add')}</CBtn>
          <button onClick={closeDiv} style={S.btnS}>{t('btn_close')}</button>
        </div>
      </CMShell>
      <ConfirmDialog />
      </>
    );
  }

  // ── Crédit immobilier ─────────────────────────────────────────────────────────
  if (modal === 'loan') {
    const c            = '#EF4444';
    const f            = fa(c);
    const totalMonthly = (parseFloat(loanForm.monthlyPayment) || 0) + (parseFloat(loanForm.insuranceAmount) || 0);
    const months       = mLeft(loanForm.endDate);
    const costLeft     = Math.max(0, months * totalMonthly - (parseFloat(loanForm.capitalRemaining) || 0));
    return (
      <CMShell T={T} title={editItem ? t('modal_loan_edit') : t('modal_loan_new')} icon="🏠" color={c} onClose={() => close(() => setLoanForm(mkLoan()))}>
        <FRow cols={2}>
          <FField style={f} label={t('loan_financed')}><input type="text" placeholder="Ex : Appartement Paris" style={S.inp} value={loanForm.name} onChange={e => setLoanForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label={t('loan_lender')}><input type="text" placeholder="Ex : Crédit Agricole" style={S.inp} value={loanForm.lender} onChange={e => setLoanForm(p => ({ ...p, lender: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('loan_capital_borrowed')}><input type="number" placeholder="0" style={S.inp} value={loanForm.capitalBorrowed} onChange={e => setLoanForm(p => ({ ...p, capitalBorrowed: e.target.value }))} /></FField>
          <FField style={f} label={t('loan_capital_remaining_f')}><input type="number" placeholder="0" style={S.inp} value={loanForm.capitalRemaining} onChange={e => setLoanForm(p => ({ ...p, capitalRemaining: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('loan_monthly_payment')}><input type="number" placeholder="0" style={S.inp} value={loanForm.monthlyPayment} onChange={e => setLoanForm(p => ({ ...p, monthlyPayment: e.target.value }))} /></FField>
          <FField style={f} label={t('loan_rate')}><input type="number" placeholder="0" step="0.01" style={S.inp} value={loanForm.rate} onChange={e => setLoanForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField style={f} label={t('loan_insurance_amount')}><input type="number" placeholder="0" style={S.inp} value={loanForm.insuranceAmount} onChange={e => setLoanForm(p => ({ ...p, insuranceAmount: e.target.value }))} /></FField>
          <FField style={f} label={t('loan_insurance_org')}><input type="text" placeholder="CNP, Crédit Mutuel…" style={S.inp} value={loanForm.insuranceOrganisme} onChange={e => setLoanForm(p => ({ ...p, insuranceOrganisme: e.target.value }))} /></FField>
          <FField style={f} label={t('loan_insurance_rate')}><input type="number" placeholder="0" step="0.001" style={S.inp} value={loanForm.insuranceRate} onChange={e => setLoanForm(p => ({ ...p, insuranceRate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label={t('loan_start_date')}><input type="date" style={S.inp} value={loanForm.startDate} onChange={e => setLoanForm(p => ({ ...p, startDate: e.target.value }))} /></FField>
          <FField style={f} label={t('loan_end_date')}><input type="date" style={S.inp} value={loanForm.endDate} onChange={e => setLoanForm(p => ({ ...p, endDate: e.target.value }))} /></FField>
        </FRow>
        {(totalMonthly > 0 || months > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: t('loan_total_monthly'), val: `${fEur(totalMonthly)}${t('per_month')}`, color: '#60a5fa' },
              { label: t('loan_remaining_duration'), val: t('months_n', months),                color: '#a78bfa' },
              { label: t('loan_remaining_cost'),     val: fEur(costLeft),                       color: '#f87171' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveLoan}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setLoanForm(mkLoan()))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Crédit consommation ────────────────────────────────────────────────────────
  if (modal === 'debt') {
    const c      = '#FB923C';
    const f      = fa(c);
    const months = mLeft(debtForm.endDate);
    return (
      <CMShell T={T} title={editItem ? t('modal_debt_edit') : t('modal_debt_new')} icon="💳" color={c} onClose={() => close(() => setDebtForm(mkDebt()))}>
        <FRow cols={2}>
          <FField style={f} label={t('f_name')}><input type="text" placeholder="Ex : Crédit auto, Crédit travaux" style={S.inp} value={debtForm.name} onChange={e => setDebtForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label={t('debt_lender')}><input type="text" placeholder="Ex : Cetelem, Sofinco" style={S.inp} value={debtForm.lender} onChange={e => setDebtForm(p => ({ ...p, lender: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField style={f} label={t('debt_capital_remaining')}><input type="number" placeholder="0" style={S.inp} value={debtForm.capitalRemaining} onChange={e => setDebtForm(p => ({ ...p, capitalRemaining: e.target.value }))} /></FField>
          <FField style={f} label={t('debt_monthly')}><input type="number" placeholder="0" style={S.inp} value={debtForm.monthlyPayment} onChange={e => setDebtForm(p => ({ ...p, monthlyPayment: e.target.value }))} /></FField>
          <FField style={f} label={t('debt_rate')}><input type="number" placeholder="0" step="0.01" style={S.inp} value={debtForm.rate} onChange={e => setDebtForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={1}>
          <FField style={f} label={t('debt_end_date')}><input type="date" style={S.inp} value={debtForm.endDate} onChange={e => setDebtForm(p => ({ ...p, endDate: e.target.value }))} /></FField>
        </FRow>
        {months > 0 && (
          <div style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>{t('loan_remaining_duration')}</span>
            <span style={{ fontWeight: 700, color: c }}>{t('months_n', months)}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveDebt}>{editItem ? t('btn_save') : t('btn_add')}</CBtn>
          <button onClick={() => close(() => setDebtForm(mkDebt()))} style={S.btnS}>{t('btn_cancel')}</button>
        </div>
      </CMShell>
    );
  }

  // ── Budget personnalisé ──────────────────────────────────────────────────────
  if (modal === 'customBudget') {
    const c = customBudgetForm.color || '#10b981';
    const f = fa(c);
    return (
      <CMShell T={T} title={editItem ? 'Modifier le budget' : 'Nouveau budget'} icon={customBudgetForm.icon || '📦'} color={c} onClose={() => close(() => setCustomBudgetForm(mkCustomBudget()))}>
        <FRow cols={2}>
          <FField style={f} label="Nom du budget">
            <input type="text" placeholder="Ex : Sorties, Vêtements…" style={S.inp} value={customBudgetForm.name} onChange={e => setCustomBudgetForm(p => ({ ...p, name: e.target.value }))} />
          </FField>
          <FField style={f} label="Plafond mensuel (€)">
            <input type="number" placeholder="0" min="0" step="1" style={S.inp} value={customBudgetForm.limit} onChange={e => setCustomBudgetForm(p => ({ ...p, limit: e.target.value }))} />
          </FField>
        </FRow>
        <FRow cols={1}>
          <FField style={f} label="Icône">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {BUDGET_ICONS.map(ic => (
                <button key={ic} onClick={() => setCustomBudgetForm(p => ({ ...p, icon: ic }))}
                  style={{ width: 36, height: 36, fontSize: 18, borderRadius: 8, border: `2px solid ${customBudgetForm.icon === ic ? c : 'transparent'}`, background: customBudgetForm.icon === ic ? c + '22' : T.bg2, cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </FField>
        </FRow>
        <FRow cols={1}>
          <FField style={f} label="Couleur">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {BUDGET_COLORS.map(col => (
                <button key={col} onClick={() => setCustomBudgetForm(p => ({ ...p, color: col }))}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: col, border: customBudgetForm.color === col ? `3px solid ${T.text}` : '2px solid transparent', cursor: 'pointer', padding: 0, boxShadow: customBudgetForm.color === col ? `0 0 0 1px ${col}` : 'none', transition: 'transform .1s', transform: customBudgetForm.color === col ? 'scale(1.2)' : 'scale(1)' }}
                />
              ))}
            </div>
          </FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveCustomBudget}>{editItem ? 'Enregistrer' : 'Créer le budget'}</CBtn>
          <button onClick={() => close(() => setCustomBudgetForm(mkCustomBudget()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  return null;
}
