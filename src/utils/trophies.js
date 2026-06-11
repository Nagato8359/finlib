// Trophy definitions and computation — pure functions, no React

export const STATUSES = [
  { key: 'bronze',  icon: '🥉', label: 'Bronze',  min: 0,    max: 199  },
  { key: 'argent',  icon: '🥈', label: 'Argent',  min: 200,  max: 499  },
  { key: 'or',      icon: '🥇', label: 'Or',      min: 500,  max: 999  },
  { key: 'platine', icon: '💎', label: 'Platine', min: 1000, max: 2499 },
  { key: 'diamant', icon: '👑', label: 'Diamant', min: 2500, max: 4999 },
  { key: 'elite',   icon: '🚀', label: 'Elite',   min: 5000, max: Infinity },
];

export const getStatus    = pts => [...STATUSES].reverse().find(s => pts >= s.min) || STATUSES[0];
export const getNextStatus = pts => STATUSES.find(s => pts < s.min) || null;

export const TROPHY_CATEGORIES = [
  { key: 'patrimoine',     label: 'Patrimoine',           icon: '🏦' },
  { key: 'investissements',label: 'Investissements',      icon: '📈' },
  { key: 'crypto',         label: 'Crypto',               icon: '₿'  },
  { key: 'epargne',        label: 'Épargne',              icon: '💰' },
  { key: 'budget',         label: 'Budget',               icon: '📊' },
  { key: 'objectifs',      label: 'Objectifs',            icon: '🎯' },
  { key: 'immobilier',     label: 'Immobilier',           icon: '🏠' },
  { key: 'matieres',       label: 'Matières premières',   icon: '⚗️' },
  { key: 'ventes',         label: 'Ventes',               icon: '🏷️' },
  { key: 'fidelite',       label: 'Fidélité',             icon: '🎂' },
  { key: 'score',          label: 'Score santé',          icon: '❤️' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function lastNMonthsPositiveSavings(transactions, n) {
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bal = transactions.filter(tx => tx.date.startsWith(key)).reduce((s, tx) => s + tx.amount, 0);
    if (bal <= 0) return false;
  }
  return true;
}

function lastNMonthsNoBudgetExceeded(transactions, budgets, n) {
  const cats = Object.keys(budgets).filter(c => budgets[c] > 0);
  if (cats.length === 0) return false;
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter(tx => tx.date.startsWith(key) && tx.amount < 0);
    if (cats.some(cat => {
      const spent = monthTx.filter(tx => tx.category === cat).reduce((s, tx) => s + Math.abs(tx.amount), 0);
      return spent > budgets[cat];
    })) return false;
  }
  return true;
}

function peaPositions(investments) {
  return (investments || []).filter(i => ['PEA', 'CTO'].includes(i.type))
    .reduce((s, i) => s + (i.positions || []).length, 0);
}

function cryptoPositions(investments) {
  return (investments || []).filter(i => i.type === 'Crypto')
    .reduce((s, i) => s + (i.positions || []).length, 0);
}

function liveVal(inv, invLiveValue) {
  return invLiveValue ? invLiveValue(inv) : (parseFloat(inv.value) || 0);
}

function typeTotal(investments, type, invLiveValue) {
  return (investments || []).filter(i => i.type === type).reduce((s, i) => s + liveVal(i, invLiveValue), 0);
}

// ── Trophy definitions ─────────────────────────────────────────────────────

export const TROPHIES = [
  // ── Patrimoine ──
  { id: 'pat_1', cat: 'patrimoine', icon: '🌱', name: 'Premiers pas',         desc: 'Patrimoine > 1 000 €',      pts: 10,  check: ({patrimoine}) => patrimoine >= 1000 },
  { id: 'pat_2', cat: 'patrimoine', icon: '🥉', name: 'En route',             desc: 'Patrimoine > 5 000 €',      pts: 20,  check: ({patrimoine}) => patrimoine >= 5000 },
  { id: 'pat_3', cat: 'patrimoine', icon: '🥈', name: 'Investisseur',         desc: 'Patrimoine > 10 000 €',     pts: 35,  check: ({patrimoine}) => patrimoine >= 10000 },
  { id: 'pat_4', cat: 'patrimoine', icon: '🥇', name: 'Sérieux',              desc: 'Patrimoine > 25 000 €',     pts: 50,  check: ({patrimoine}) => patrimoine >= 25000 },
  { id: 'pat_5', cat: 'patrimoine', icon: '💎', name: 'Fortuné',              desc: 'Patrimoine > 50 000 €',     pts: 75,  check: ({patrimoine}) => patrimoine >= 50000 },
  { id: 'pat_6', cat: 'patrimoine', icon: '💎', name: 'Riche',                desc: 'Patrimoine > 100 000 €',    pts: 100, check: ({patrimoine}) => patrimoine >= 100000 },
  { id: 'pat_7', cat: 'patrimoine', icon: '👑', name: 'Élite',                desc: 'Patrimoine > 250 000 €',    pts: 150, check: ({patrimoine}) => patrimoine >= 250000 },
  { id: 'pat_8', cat: 'patrimoine', icon: '🚀', name: 'Liberté financière',   desc: 'Patrimoine > 500 000 €',    pts: 200, check: ({patrimoine}) => patrimoine >= 500000 },
  { id: 'pat_9', cat: 'patrimoine', icon: '🌟', name: 'Millionnaire',         desc: 'Patrimoine > 1 000 000 €',  pts: 500, check: ({patrimoine}) => patrimoine >= 1000000 },

  // ── Investissements PEA/CTO ──
  { id: 'inv_1', cat: 'investissements', icon: '📈', name: 'Premier achat',        desc: '1 position en bourse',         pts: 10,  check: ({investments}) => peaPositions(investments) >= 1 },
  { id: 'inv_2', cat: 'investissements', icon: '📊', name: 'Diversifié',           desc: '5 positions en bourse',        pts: 20,  check: ({investments}) => peaPositions(investments) >= 5 },
  { id: 'inv_3', cat: 'investissements', icon: '🌍', name: 'Portefeuille solide',  desc: '10 positions en bourse',       pts: 35,  check: ({investments}) => peaPositions(investments) >= 10 },
  { id: 'inv_4', cat: 'investissements', icon: '🏦', name: 'Gestionnaire',         desc: '20 positions en bourse',       pts: 50,  check: ({investments}) => peaPositions(investments) >= 20 },
  { id: 'inv_5', cat: 'investissements', icon: '👔', name: 'Pro',                  desc: '30 positions en bourse',       pts: 75,  check: ({investments}) => peaPositions(investments) >= 30 },
  { id: 'inv_6', cat: 'investissements', icon: '🎯', name: 'Expert PEA',           desc: 'PEA atteint 150 000 €',        pts: 150,
    check: ({investments, invLiveValue}) => typeTotal(investments, 'PEA', invLiveValue) >= 150000 },

  // ── Crypto ──
  { id: 'cry_1', cat: 'crypto', icon: '⚡', name: 'Crypto curieux',       desc: '1 crypto en portefeuille',    pts: 10,
    check: ({investments}) => cryptoPositions(investments) >= 1 },
  { id: 'cry_2', cat: 'crypto', icon: '🪙', name: 'Hodler',               desc: '3 cryptos différentes',       pts: 20,
    check: ({investments}) => cryptoPositions(investments) >= 3 },
  { id: 'cry_3', cat: 'crypto', icon: '🌐', name: 'DeFi adepte',          desc: '5 cryptos différentes',       pts: 35,
    check: ({investments}) => cryptoPositions(investments) >= 5 },
  { id: 'cry_4', cat: 'crypto', icon: '💰', name: 'Whale',                desc: 'Crypto > 10 000 €',           pts: 75,
    check: ({investments, invLiveValue}) => typeTotal(investments, 'Crypto', invLiveValue) >= 10000 },
  { id: 'cry_5', cat: 'crypto', icon: '🚀', name: 'Crypto millionnaire',  desc: 'Crypto > 100 000 €',          pts: 200,
    check: ({investments, invLiveValue}) => typeTotal(investments, 'Crypto', invLiveValue) >= 100000 },

  // ── Épargne ──
  { id: 'sav_1', cat: 'epargne', icon: '💰', name: 'Épargnant',   desc: "Taux d'épargne > 10%",                  pts: 15,  check: ({savingsRate}) => savingsRate >= 10 },
  { id: 'sav_2', cat: 'epargne', icon: '💪', name: 'Discipliné',  desc: "Taux d'épargne > 20%",                  pts: 25,  check: ({savingsRate}) => savingsRate >= 20 },
  { id: 'sav_3', cat: 'epargne', icon: '🎯', name: 'Excellent',   desc: "Taux d'épargne > 30%",                  pts: 40,  check: ({savingsRate}) => savingsRate >= 30 },
  { id: 'sav_4', cat: 'epargne', icon: '🔥', name: 'Spartan',     desc: "Taux d'épargne > 50%",                  pts: 100, check: ({savingsRate}) => savingsRate >= 50 },
  { id: 'sav_5', cat: 'epargne', icon: '📅', name: 'Régulier',    desc: 'Épargne positive 3 mois consécutifs',   pts: 30,  check: ({transactions}) => lastNMonthsPositiveSavings(transactions, 3) },
  { id: 'sav_6', cat: 'epargne', icon: '🏆', name: 'Constant',    desc: 'Épargne positive 6 mois consécutifs',   pts: 60,  check: ({transactions}) => lastNMonthsPositiveSavings(transactions, 6) },
  { id: 'sav_7', cat: 'epargne', icon: '👑', name: 'Imbattable',  desc: 'Épargne positive 12 mois consécutifs',  pts: 150, check: ({transactions}) => lastNMonthsPositiveSavings(transactions, 12) },

  // ── Budget ──
  { id: 'bud_1', cat: 'budget', icon: '✅',  name: 'Sous contrôle', desc: '0 budget dépassé (1 mois)',   pts: 15,  check: ({transactions, budgets}) => lastNMonthsNoBudgetExceeded(transactions, budgets, 1) },
  { id: 'bud_2', cat: 'budget', icon: '🎖️', name: 'Maître',        desc: '0 budget dépassé (3 mois)',   pts: 40,  check: ({transactions, budgets}) => lastNMonthsNoBudgetExceeded(transactions, budgets, 3) },
  { id: 'bud_3', cat: 'budget', icon: '🏅',  name: 'Parfait',       desc: '0 budget dépassé (6 mois)',   pts: 80,  check: ({transactions, budgets}) => lastNMonthsNoBudgetExceeded(transactions, budgets, 6) },
  { id: 'bud_4', cat: 'budget', icon: '💯',  name: 'Légendaire',    desc: '0 budget dépassé (12 mois)',  pts: 200, check: ({transactions, budgets}) => lastNMonthsNoBudgetExceeded(transactions, budgets, 12) },

  // ── Objectifs ──
  { id: 'obj_1', cat: 'objectifs', icon: '🎯', name: 'Ambitieux',     desc: '1 objectif créé',        pts: 5,   check: ({goals}) => (goals || []).length >= 1 },
  { id: 'obj_2', cat: 'objectifs', icon: '✅', name: 'Réalisateur',   desc: '1 objectif atteint',     pts: 50,  check: ({goals, patrimoine}) => (goals || []).filter(g => patrimoine >= g.target).length >= 1 },
  { id: 'obj_3', cat: 'objectifs', icon: '🏆', name: 'Serial winner', desc: '3 objectifs atteints',   pts: 100, check: ({goals, patrimoine}) => (goals || []).filter(g => patrimoine >= g.target).length >= 3 },
  { id: 'obj_4', cat: 'objectifs', icon: '👑', name: 'Champion',      desc: '5 objectifs atteints',   pts: 200, check: ({goals, patrimoine}) => (goals || []).filter(g => patrimoine >= g.target).length >= 5 },

  // ── Immobilier ──
  { id: 'imm_1', cat: 'immobilier', icon: '🏠', name: 'Propriétaire',       desc: '1 bien immobilier',  pts: 50,  check: ({investments}) => (investments || []).filter(i => i.type === 'Immobilier').length >= 1 },
  { id: 'imm_2', cat: 'immobilier', icon: '🏘️', name: 'Investisseur immo',  desc: '2 biens',            pts: 100, check: ({investments}) => (investments || []).filter(i => i.type === 'Immobilier').length >= 2 },
  { id: 'imm_3', cat: 'immobilier', icon: '🏙️', name: 'Promoteur',          desc: '3 biens',            pts: 200, check: ({investments}) => (investments || []).filter(i => i.type === 'Immobilier').length >= 3 },
  { id: 'imm_4', cat: 'immobilier', icon: '👑', name: 'Magnat',              desc: '5 biens',            pts: 400, check: ({investments}) => (investments || []).filter(i => i.type === 'Immobilier').length >= 5 },

  // ── Matières premières ──
  { id: 'mat_1', cat: 'matieres', icon: '🥇', name: "Or et richesse",  desc: "Posséder de l'or",                    pts: 25,
    check: ({investments}) => (investments || []).some(i => (i.positions || []).some(p => p.posType === 'commodity' && p.commodityType === 'Or')) },
  { id: 'mat_2', cat: 'matieres', icon: '⚗️', name: 'Alchimiste',     desc: '3 matières premières différentes',    pts: 50,
    check: ({investments}) => new Set((investments || []).flatMap(i => (i.positions || []).filter(p => p.posType === 'commodity').map(p => p.commodityType))).size >= 3 },
  { id: 'mat_3', cat: 'matieres', icon: '💰', name: 'Commodities',    desc: '> 5 000 € en matières premières',     pts: 100,
    check: ({investments}) => (investments || []).flatMap(i => (i.positions || []).filter(p => p.posType === 'commodity')).reduce((s, p) => s + (p.shares || 0) * (p.currentPrice || p.buyPrice || 0), 0) >= 5000 },

  // ── Ventes ──
  { id: 'ven_1', cat: 'ventes', icon: '🛍️', name: 'Premier bénéfice', desc: '1 vente avec bénéfice',          pts: 15,  check: ({soldHistory}) => (soldHistory || []).some(i => (parseFloat(i.profit) || 0) > 0) },
  { id: 'ven_2', cat: 'ventes', icon: '💼', name: 'Revendeur',         desc: '5 ventes réalisées',             pts: 30,  check: ({soldHistory}) => (soldHistory || []).length >= 5 },
  { id: 'ven_3', cat: 'ventes', icon: '📦', name: 'Marchand',          desc: '10 ventes réalisées',            pts: 60,  check: ({soldHistory}) => (soldHistory || []).length >= 10 },
  { id: 'ven_4', cat: 'ventes', icon: '💰', name: 'Profit 500 €',      desc: '500 € de bénéfices cumulés',    pts: 50,  check: ({soldHistory}) => (soldHistory || []).reduce((s, i) => s + (parseFloat(i.profit) || 0), 0) >= 500 },
  { id: 'ven_5', cat: 'ventes', icon: '💎', name: 'Profit 5 000 €',    desc: '5 000 € de bénéfices cumulés',  pts: 150, check: ({soldHistory}) => (soldHistory || []).reduce((s, i) => s + (parseFloat(i.profit) || 0), 0) >= 5000 },
  { id: 'ven_6', cat: 'ventes', icon: '👑', name: 'Trader',            desc: '10 000 € de bénéfices cumulés', pts: 300, check: ({soldHistory}) => (soldHistory || []).reduce((s, i) => s + (parseFloat(i.profit) || 0), 0) >= 10000 },

  // ── Fidélité ──
  { id: 'fid_0', cat: 'fidelite', icon: '🌱', name: 'Nouveau membre', desc: 'Inscription',        pts: 5,   check: ({user}) => !!user },
  { id: 'fid_1', cat: 'fidelite', icon: '📅', name: '1 mois',         desc: 'Membre 1 mois',      pts: 10,  check: ({user}) => user && (Date.now() - new Date(user.created_at)) >= 30 * 86400000 },
  { id: 'fid_2', cat: 'fidelite', icon: '🗓️', name: '3 mois',         desc: 'Membre 3 mois',      pts: 20,  check: ({user}) => user && (Date.now() - new Date(user.created_at)) >= 90 * 86400000 },
  { id: 'fid_3', cat: 'fidelite', icon: '🎂', name: '6 mois',         desc: 'Membre 6 mois',      pts: 40,  check: ({user}) => user && (Date.now() - new Date(user.created_at)) >= 180 * 86400000 },
  { id: 'fid_4', cat: 'fidelite', icon: '🎊', name: '1 an',           desc: 'Membre 1 an',        pts: 100, check: ({user}) => user && (Date.now() - new Date(user.created_at)) >= 365 * 86400000 },
  { id: 'fid_5', cat: 'fidelite', icon: '🏆', name: '2 ans',          desc: 'Membre 2 ans',       pts: 200, check: ({user}) => user && (Date.now() - new Date(user.created_at)) >= 730 * 86400000 },
  { id: 'fid_6', cat: 'fidelite', icon: '👑', name: 'Vétéran 3 ans',  desc: 'Membre 3 ans',       pts: 400, check: ({user}) => user && (Date.now() - new Date(user.created_at)) >= 1095 * 86400000 },

  // ── Score santé ──
  { id: 'sco_1', cat: 'score', icon: '💚', name: 'Bonne santé',       desc: 'Score > 50',    pts: 20,  check: ({score}) => score >= 50 },
  { id: 'sco_2', cat: 'score', icon: '💛', name: 'Très bonne santé',  desc: 'Score > 70',    pts: 40,  check: ({score}) => score >= 70 },
  { id: 'sco_3', cat: 'score', icon: '🔥', name: 'Excellent',         desc: 'Score > 85',    pts: 80,  check: ({score}) => score >= 85 },
  { id: 'sco_4', cat: 'score', icon: '💎', name: 'Parfait',           desc: 'Score = 100',   pts: 200, check: ({score}) => score >= 100 },
];

// ── Main computation ────────────────────────────────────────────────────────

export function computeTrophies(data) {
  const ctx = {
    patrimoine:   data.patrimoine   || 0,
    investments:  data.investments  || [],
    invLiveValue: data.invLiveValue,
    savingsRate:  data.savingsRate  || 0,
    transactions: data.transactions || [],
    budgets:      data.budgets      || {},
    goals:        data.goals        || [],
    soldHistory:  data.soldHistory  || [],
    score:        data.score        || 0,
    user:         data.user         || null,
  };

  const trophies = TROPHIES.map(t => {
    let unlocked = false;
    try { unlocked = !!t.check(ctx); } catch {}
    return { ...t, unlocked };
  });

  const unlocked = trophies.filter(t => t.unlocked);
  const totalPoints = unlocked.reduce((s, t) => s + t.pts, 0);
  const status      = getStatus(totalPoints);
  const nextStatus  = getNextStatus(totalPoints);
  const progressPct = nextStatus
    ? Math.min(100, ((totalPoints - status.min) / (nextStatus.min - status.min)) * 100)
    : 100;

  return {
    trophies,
    totalPoints,
    status,
    nextStatus,
    progressPct,
    pointsToNext: nextStatus ? nextStatus.min - totalPoints : 0,
    unlockedCount: unlocked.length,
    totalCount:    TROPHIES.length,
  };
}
