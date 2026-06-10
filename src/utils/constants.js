// ── Formatters ──────────────────────────────────────────────────────────────
export const fEur = (n, c = false) =>
  c && Math.abs(n) >= 1000
    ? (n / 1000).toFixed(1).replace('.', ',') + ' k€'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const fPct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
export const fDate = d => new Date(d).toLocaleDateString('fr-FR');
export const fPrice = n => {
  if (n == null) return '—';
  const dec = n < 1 ? 6 : n < 100 ? 2 : 0;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: dec }).format(n);
};
export const today = () => new Date().toISOString().slice(0, 10);
export const uid = () => Date.now() + Math.random().toString(36).slice(2);
export const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// ── Theme tokens ────────────────────────────────────────────────────────────
export const DK = {
  bg: '#080e1a', bg2: '#0d1526', bg3: '#111827',
  cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
  text: '#f1f5f9', textMuted: '#9ca3af', textFaint: '#4b5563',
  inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.12)',
};
export const LK = {
  bg: '#f8fafc', bg2: '#f1f5f9', bg3: '#ffffff',
  cardBg: '#ffffff', cardBorder: '#e2e8f0',
  text: '#0f172a', textMuted: '#64748b', textFaint: '#94a3b8',
  inputBg: '#f8fafc', inputBorder: '#cbd5e1',
};

// ── Style factory (depends on T) ────────────────────────────────────────────
export const makeS = T => ({
  card: { background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '20px 24px' },
  inp: { background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: '9px 12px', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit' },
  btnG: { background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnS: { background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.textMuted, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btnD: { background: 'rgba(248,113,113,0.10)', border: 'none', borderRadius: 8, color: '#f87171', padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
});

// ── Color maps ───────────────────────────────────────────────────────────────
export const CAT_COLORS = {
  Revenus: '#10b981', Logement: '#f87171', Alimentation: '#fb923c', Factures: '#a78bfa',
  Abonnements: '#60a5fa', Transport: '#34d399', Santé: '#f472b6', Loisirs: '#facc15',
  Épargne: '#4ade80', Autres: '#94a3b8',
};
export const INV_CATS = ['Actions', 'Crypto', 'Obligataire', 'Immobilier', 'Épargne liquide', 'Autres'];
export const INV_COLORS = ['#10b981', '#f59e0b', '#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#facc15'];
export const HEALTH_CATS = ['Voiture', 'Immobilier physique', 'Collection', 'Électronique', 'Mobilier', 'Bijoux', 'Autres'];
export const CASH_TYPES = ['Compte courant', 'Livret A', 'LDD', 'LEP', 'Livret Jeune', 'PEL', 'CEL', 'Fonds euros AV', 'PEA', 'Autre'];
export const CASH_TYPE_COLORS = { 'Compte courant': '#60a5fa', 'Livret A': '#34d399', 'LDD': '#4ade80', 'LEP': '#f59e0b', 'Livret Jeune': '#fb923c', 'PEL': '#a78bfa', 'CEL': '#f472b6', 'Fonds euros AV': '#38bdf8', 'PEA': '#818cf8', 'Autre': '#94a3b8' };
export const CASH_TYPE_INFO = {
  'Compte courant': { cap: null, rate: 0 },
  'Livret A':       { cap: 22950,  rate: 2.4 },
  'LDD':            { cap: 12000,  rate: 2.4 },
  'LEP':            { cap: 10000,  rate: 3.5 },
  'Livret Jeune':   { cap: 1600,   rate: 3.0 },
  'PEL':            { cap: 61200,  rate: 1.75 },
  'CEL':            { cap: 15300,  rate: 1.5 },
  'Fonds euros AV': { cap: null,   rate: 2.5 },
  'PEA':            { cap: 150000, rate: 0 },
  'Autre':          { cap: null,   rate: 0 },
};
export const LISTING_CATS = ['Objet physique', 'Crypto', 'Action', 'ETF'];
export const LISTING_PLATFORMS = ['Vinted', 'eBay', 'LeBonCoin', 'Binance', 'Bourse Direct', 'Autre'];
export const LISTING_CAT_COLORS = { 'Objet physique': '#fb923c', Crypto: '#f59e0b', Action: '#10b981', ETF: '#60a5fa' };
export const LISTING_PLATFORM_ICONS = { Vinted: '👗', eBay: '🛍️', LeBonCoin: '📦', Binance: '🪙', 'Bourse Direct': '📈', Autre: '🏷️' };

// ── CSV auto-categorisation keywords ─────────────────────────────────────────
export const CAT_KEYWORDS = {
  Revenus:      ['salaire', 'freelance', 'virement reçu', 'allocation', 'prime', 'indemnité', 'dividende'],
  Logement:     ['loyer', 'charges', 'copropriété', 'assurance habitation', 'taxe foncière', 'syndic'],
  Alimentation: ['carrefour', 'leclerc', 'monoprix', 'lidl', 'aldi', 'intermarché', 'casino', 'franprix', 'picard', 'mcdo', 'mcdonald', 'burger', 'kfc', 'pizza', 'boulangerie', 'supermarché', 'superette', 'drive'],
  Factures:     ['edf', 'engie', 'eau ', 'sfr', 'orange', 'bouygues', 'free mobile', 'electricite', 'électricité', 'gaz', 'internet', 'téléphone'],
  Abonnements:  ['netflix', 'spotify', 'amazon prime', 'disney', 'apple.com', 'deezer', 'youtube premium', 'adobe', 'microsoft 365', 'abonnement'],
  Transport:    ['sncf', 'ratp', 'navigo', 'uber', 'taxi', 'total', 'bp station', 'shell', 'péage', 'autoroute', 'vélib'],
  Santé:        ['pharmacie', 'médecin', 'docteur', 'clinique', 'dentiste', 'kiné', 'mutuelle', 'cpam'],
  Loisirs:      ['cinéma', 'cinema', 'fnac', 'amazon.fr', 'sport', 'fitness', 'jeux', 'livre', 'théâtre', 'concert', 'hôtel', 'airbnb', 'booking', 'voyage'],
  Épargne:      ['livret a', 'ldd', 'assurance vie', 'épargne', 'pel '],
};

// ── Platforms (Investir tab) ──────────────────────────────────────────────────
export const PLATFORMS = [
  { name: 'Binance', desc: 'Plus grande plateforme crypto mondiale. Accès à 350+ cryptos, staking et DeFi.', url: 'https://www.binance.com', color: '#f0b90b', emoji: '₿', tags: ['Crypto', 'DeFi', 'Staking'] },
  { name: 'Crypto.com', desc: 'Plateforme crypto avec carte Visa et cashback jusqu\'à 8% en CRO.', url: 'https://crypto.com', color: '#1199fa', emoji: 'Ⓒ', tags: ['Crypto', 'Carte Visa'] },
  { name: 'Boursobank', desc: 'Banque en ligne française. PEA, compte-titres, livrets et assurance-vie.', url: 'https://www.boursobank.com', color: '#0070f3', emoji: '🏦', tags: ['PEA', 'Bourse', 'Livret A'] },
  { name: 'Revolut', desc: 'Super-app financière : actions, crypto, change et outils de budget.', url: 'https://www.revolut.com', color: '#7c3aed', emoji: '⚡', tags: ['Crypto', 'Actions', 'Budget'] },
  { name: 'Trade Republic', desc: 'Courtier européen à 0 € de frais. ETF, actions, obligations et plans d\'épargne.', url: 'https://www.traderepublic.com', color: '#a855f7', emoji: '📈', tags: ['ETF', 'Actions', '0 € frais'] },
  { name: 'Bourse Direct', desc: 'Courtier français spécialisé PEA & bourse française depuis 2000.', url: 'https://www.boursedirect.fr', color: '#ef4444', emoji: '🏛️', tags: ['PEA', 'CAC 40', 'Actions FR'] },
];

// ── Seed data ────────────────────────────────────────────────────────────────
export const SEED_TX = [
  { id: uid(), date: '2026-06-01', label: 'Salaire', category: 'Revenus', amount: 2800, type: 'income', recurrent: true },
  { id: uid(), date: '2026-06-02', label: 'Loyer', category: 'Logement', amount: -950, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-06-03', label: 'Courses Leclerc', category: 'Alimentation', amount: -120, type: 'expense', recurrent: false },
  { id: uid(), date: '2026-06-05', label: 'EDF', category: 'Factures', amount: -85, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-06-06', label: 'Netflix', category: 'Abonnements', amount: -18, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-05-01', label: 'Salaire', category: 'Revenus', amount: 2800, type: 'income', recurrent: true },
  { id: uid(), date: '2026-05-02', label: 'Loyer', category: 'Logement', amount: -950, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-05-10', label: 'Restaurant', category: 'Alimentation', amount: -65, type: 'expense', recurrent: false },
  { id: uid(), date: '2026-05-15', label: 'Freelance', category: 'Revenus', amount: 450, type: 'income', recurrent: false },
  { id: uid(), date: '2026-04-01', label: 'Salaire', category: 'Revenus', amount: 2800, type: 'income', recurrent: true },
  { id: uid(), date: '2026-04-02', label: 'Loyer', category: 'Logement', amount: -950, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-04-12', label: 'Courses', category: 'Alimentation', amount: -98, type: 'expense', recurrent: false },
  { id: uid(), date: '2026-03-01', label: 'Salaire', category: 'Revenus', amount: 2750, type: 'income', recurrent: true },
  { id: uid(), date: '2026-03-02', label: 'Loyer', category: 'Logement', amount: -950, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-02-01', label: 'Salaire', category: 'Revenus', amount: 2750, type: 'income', recurrent: true },
  { id: uid(), date: '2026-02-02', label: 'Loyer', category: 'Logement', amount: -950, type: 'expense', recurrent: true },
  { id: uid(), date: '2026-01-01', label: 'Salaire', category: 'Revenus', amount: 2750, type: 'income', recurrent: true },
  { id: uid(), date: '2026-01-02', label: 'Loyer', category: 'Logement', amount: -950, type: 'expense', recurrent: true },
];
export const SEED_INV = [
  { id: uid(), name: 'PEA — ETF World', category: 'Actions', value: 12400, invested: 10000, color: '#10b981', positions: [
    { id: uid(), ticker: 'CW8', name: 'Amundi MSCI World', shares: 40, buyPrice: 280, currentPrice: 310 },
    { id: uid(), ticker: 'WPEA', name: 'iShares Core MSCI World', shares: 20, buyPrice: 68, currentPrice: 74 },
  ] },
  { id: uid(), name: 'Bitcoin (BTC)', category: 'Crypto', value: 8200, invested: 5000, color: '#f59e0b', positions: [
    { id: uid(), ticker: 'BTC', name: 'Bitcoin', shares: 0.12, buyPrice: 41667, currentPrice: 68333 },
  ] },
  { id: uid(), name: 'Assurance-vie fonds €', category: 'Obligataire', value: 5500, invested: 5200, color: '#60a5fa', positions: [] },
  { id: uid(), name: 'RealT (immobilier)', category: 'Immobilier', value: 1800, invested: 2000, color: '#a78bfa', positions: [] },
];
export const SEED_HEALTH = [
  { id: uid(), name: 'Renault Clio', category: 'Voiture', buyPrice: 8000, currentValue: 5500, date: '2022-03-01', notes: '' },
  { id: uid(), name: 'Collection Pop Figures', category: 'Collection', buyPrice: 1200, currentValue: 1800, date: '2020-01-01', notes: '~60 figurines' },
  { id: uid(), name: 'Collection Yugioh', category: 'Collection', buyPrice: 800, currentValue: 1200, date: '2019-06-01', notes: 'Cartes rares' },
];
export const SEED_BUDGETS = { Logement: 1000, Alimentation: 400, Transport: 150, Loisirs: 200, Abonnements: 80, Factures: 150, Santé: 100, Autres: 200 };
export const SEED_GOALS = [
  { id: uid(), name: 'Indépendance financière', target: 300000, deadline: '2035-01-01', color: '#10b981' },
  { id: uid(), name: 'Achat immobilier', target: 50000, deadline: '2029-01-01', color: '#60a5fa' },
];
export const SEED_CASH = [
  { id: uid(), name: 'Compte courant BNP', type: 'Compte courant', balance: 2500, rate: 0 },
  { id: uid(), name: 'Livret A', type: 'Livret A', balance: 7500, rate: 3.0 },
  { id: uid(), name: 'LDD Société Générale', type: 'LDD', balance: 4000, rate: 2.4 },
];
export const SEED_LISTINGS = [
  { id: uid(), name: 'iPhone 13 Pro 256 Go', category: 'Objet physique', platform: 'eBay', buyPrice: 650, sellPrice: 520, fees: 30, listedDate: '2026-05-15', notes: 'Bon état, avec boîte' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
export const calcScore = ({ savingsRate, diversif, emergencyMonths, debtRatio, consecutiveSavingsMonths }) => {
  // 1. Taux d'épargne (25 pts)
  let s = 0;
  if (savingsRate >= 20) s = 25;
  else if (savingsRate >= 10) s = 12 + ((savingsRate - 10) / 10) * 13;
  else if (savingsRate > 0) s = (savingsRate / 10) * 12;

  // 2. Diversification (20 pts)
  let d = 0;
  if (diversif >= 5) d = 20;
  else if (diversif >= 3) d = 12 + ((diversif - 3) / 2) * 8;
  else if (diversif === 2) d = 8;
  else if (diversif === 1) d = 4;

  // 3. Épargne de précaution (20 pts)
  let e = 0;
  if (emergencyMonths >= 6) e = 20;
  else if (emergencyMonths >= 3) e = 15 + ((emergencyMonths - 3) / 3) * 5;
  else if (emergencyMonths >= 1) e = 7 + ((emergencyMonths - 1) / 2) * 8;
  else if (emergencyMonths > 0) e = emergencyMonths * 7;

  // 4. Ratio dettes/patrimoine (20 pts)
  const dPct = debtRatio * 100;
  const dr = dPct === 0 ? 20 : dPct < 30 ? 15 : dPct < 60 ? 8 : 0;

  // 5. Régularité épargne (15 pts)
  const r = consecutiveSavingsMonths >= 3 ? 15 : consecutiveSavingsMonths === 2 ? 10 : consecutiveSavingsMonths === 1 ? 5 : 0;

  return Math.min(100, Math.round(s + d + e + dr + r));
};

// ── Shared UI atoms ──────────────────────────────────────────────────────────
export const Label = ({ children }) => (
  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
    {children}
  </label>
);

export const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#f1f5f9', fontWeight: 600 }}>{p.name}: {fEur(p.value)}</div>
      ))}
    </div>
  );
};

export const KPI = ({ label, value, sub, accent, icon, T }) => (
  <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', lineHeight: 1.4 }}>{label}</span>
      {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
    </div>
    <span style={{ fontSize: 22, fontWeight: 700, color: accent || T.text, letterSpacing: '-.02em' }}>{value}</span>
    {sub && <span style={{ fontSize: 12, color: sub.startsWith('+') ? '#4ade80' : sub.startsWith('-') ? '#f87171' : T.textFaint }}>{sub}</span>}
  </div>
);

export const ModalShell = ({ title, onClose, children, T }) => (
  <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 'env(safe-area-inset-top)' }}>
    <div className="modal-box" style={{ background: T.bg3, border: `1px solid ${T.cardBorder}`, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</h3>
        <button onClick={onClose} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.textMuted, padding: '4px 10px', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);
