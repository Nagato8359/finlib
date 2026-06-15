import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  uid, today, MONTHS, INV_COLORS, CAT_COLORS, CAT_KEYWORDS,
  SEED_TX, SEED_INV, SEED_HEALTH, SEED_BUDGETS, SEED_GOALS, SEED_CASH, SEED_LISTINGS,
  calcScore, fEur, PORTFOLIO_TYPE_COLOR, CAT_TO_PORTFOLIO_TYPE,
} from '../utils/constants';
import { notifyOnce, clearSentNotifications, checkAndSendDailyNotif, checkReminderNotif, registerPush } from '../utils/notifications';

const API_BASE = '';

const COMMODITY_TICKER_MAP = {
  'Or': 'GC=F', 'Argent': 'SI=F', 'Platine': 'PL=F',
  'Palladium': 'PA=F', 'Pétrole': 'CL=F', 'Cuivre': 'HG=F',
};
// EUR/troy oz for metals, EUR/barrel for oil, EUR/lb for copper → EUR/unit
function commodityUnitFactor(type, unit) {
  if (type === 'Pétrole') return 1;
  if (type === 'Cuivre') {
    if (unit === 'kilogrammes') return 2.20462;
    if (unit === 'tonnes')      return 2204.62;
    return 1;
  }
  if (unit === 'onces troy')  return 1;
  if (unit === 'kilogrammes') return 32.1507;
  return 1 / 31.1035;  // grammes (default for metals)
}

const mkTx      = () => ({ date: today(), label: '', category: 'Alimentation', amount: '', type: 'expense', recurrent: false, accountId: '', destAccountId: '', loanId: '' });
const mkInv     = () => ({ name: '', category: 'Actions', value: '', invested: '', notes: '' });
const mkPortfolio = () => ({
  name: '', type: 'PEA', courtier: '', openDate: '', devise: 'EUR',
  assureur: '', avType: 'Fonds euros', platform: '', walletType: 'CEX',
  immoBien: 'Locatif', adresse: '', acquisitionDate: '', loanId: '', loyerMensuel: '', chargesMensuelles: '',
  employeur: '', peType: 'PEE', disponibiliteDate: '',
  value: '', invested: '', cash: '', notes: '',
});
const mkHealth  = () => ({ name: '', category: '', buyPrice: '', currentValue: '', date: today(), notes: '', condition: 'Bon état', storageLocation: '' });
const mkPos     = () => ({
  // Core — backward compat
  isin: '', ticker: '', name: '', shares: '', buyPrice: '', currentPrice: '', divYield: '',
  // Common
  posType: '', purchaseDate: '', notes: '',
  // Stock extras
  exchange: '', currency: 'EUR', divRate: '', exDivDate: '', divFrequency: '',
  // Crypto
  platform: '',
  // Real estate
  propertyType: 'Locatif', address: '', surface: '', purchaseValue: '',
  estimatedValue: '', monthlyRent: '', monthlyCharges: '', linkedLoanId: '',
  // Bond/fonds euros
  insurer: '', guaranteedRate: '',
  // Commodity
  commodityType: 'Or', unit: 'grammes', storageLocation: '',
});
const mkGoal    = () => ({ name: '', target: '', deadline: '', color: '#10b981' });
const mkCash    = () => ({ name: '', type: 'Livret A', balance: '', rate: '' });
const mkListing = () => ({ name: '', category: '', platform: '', buyPrice: '', sellPrice: '', fees: '', listedDate: today(), notes: '', condition: 'Bon état', storageLocation: '' });
const mkLoan    = () => ({ name: '', lender: '', capitalBorrowed: '', capitalRemaining: '', monthlyPayment: '', rate: '', insuranceAmount: '', insuranceOrganisme: '', insuranceRate: '', startDate: today(), endDate: '' });
const mkDebt         = () => ({ name: '', lender: '', capitalRemaining: '', monthlyPayment: '', rate: '', endDate: '' });
const mkCustomBudget = () => ({ name: '', icon: '📦', limit: '', color: '#10b981' });

// ── Recurring tx generator (pure) ────────────────────────────────────────────
const applyRecurrences = (txs) => {
  const originals = txs.filter(t => t.recurrent && !t.recurrentSourceId);
  const generatedKeys = new Set(
    txs.filter(t => t.recurrentSourceId)
      .map(t => `${t.recurrentSourceId}:${t.date.slice(0, 7)}`)
  );
  const toAdd = [];
  const now = new Date();

  originals.forEach(orig => {
    const origDay = parseInt(orig.date.slice(8, 10), 10);
    const origDate = new Date(orig.date);
    let cur = new Date(origDate.getFullYear(), origDate.getMonth() + 1, 1);
    while (cur <= now) {
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const yyyy = cur.getFullYear();
      const key = `${orig.id}:${yyyy}-${mm}`;
      if (!generatedKeys.has(key)) {
        const daysInMonth = new Date(yyyy, cur.getMonth() + 1, 0).getDate();
        const actualDay = Math.min(origDay, daysInMonth);
        toAdd.push({
          ...orig,
          id: uid(),
          date: `${yyyy}-${mm}-${String(actualDay).padStart(2, '0')}`,
          recurrentSourceId: orig.id,
        });
        generatedKeys.add(key);
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  });

  return toAdd;
};

// ── CSV auto-categorisation ───────────────────────────────────────────────────
const detectCategory = (label) => {
  const lower = label.toLowerCase();
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'Autres';
};

export const parseCSV = (text) => {
  const raw = text.replace(/\r/g, '');
  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  const idx = (candidates) => candidates.reduce((found, c) => found >= 0 ? found : headers.findIndex(h => h.includes(c)), -1);
  const dateIdx   = idx(['date']);
  const labelIdx  = idx(['libellé', 'label', 'opération', 'description', 'libelle']);
  const amountIdx = idx(['montant', 'amount', 'valeur']);
  const debitIdx  = headers.findIndex(h => h === 'débit' || h === 'debit');
  const creditIdx = headers.findIndex(h => h === 'crédit' || h === 'credit');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.replace(/^"|"$/g, '').trim());
    if (cells.length < 2) continue;

    const rawDate = dateIdx >= 0 ? cells[dateIdx] : cells[0];
    const label   = labelIdx >= 0 ? cells[labelIdx] : cells[1] || '';

    let amount = 0;
    if (amountIdx >= 0) {
      amount = parseFloat(cells[amountIdx].replace(/\s/g, '').replace(',', '.')) || 0;
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const deb = debitIdx  >= 0 ? parseFloat((cells[debitIdx]  || '0').replace(/\s/g, '').replace(',', '.')) || 0 : 0;
      const cred = creditIdx >= 0 ? parseFloat((cells[creditIdx] || '0').replace(/\s/g, '').replace(',', '.')) || 0 : 0;
      amount = cred - deb;
    }

    // Parse DD/MM/YYYY or YYYY-MM-DD
    let date = '';
    if (/\d{2}\/\d{2}\/\d{4}/.test(rawDate)) {
      const [d, m, y] = rawDate.split('/');
      date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    } else if (/\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      date = rawDate.slice(0, 10);
    }

    if (!date || !label.trim() || amount === 0) continue;
    rows.push({ date, label: label.trim(), amount, category: detectCategory(label) });
  }
  return rows;
};

export function useData() {
  // ── Raw state ──────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [healthAssets, setHealthAssets] = useState([]);
  const [budgets, setBudgets] = useState(SEED_BUDGETS);
  const [ioBannerMsg, setIoBannerMsg] = useState(null);
  const [customBudgets, setCustomBudgets] = useState([]);
  const [customBudgetForm, setCustomBudgetForm] = useState(mkCustomBudget());
  const [goals, setGoals] = useState([]);
  const [savings, setSavings] = useState([]);
  const [listings, setListings] = useState([]);
  const [soldHistory, setSoldHistory] = useState([]);
  const [loans, setLoans] = useState([]);
  const [debts, setDebts] = useState([]);
  const [projYears, setProjYears] = useState(10);
  const [projRate, setProjRate] = useState(7);
  const [projMonthly, setProjMonthly] = useState(500);

  // ── Modal / form state ──────────────────────────────────────────────────────
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [drillInv, setDrillInv] = useState(null);
  const [txForm, setTxForm] = useState(mkTx);
  const [invForm, setInvForm] = useState(mkInv);
  const [healthForm, setHealthForm] = useState(mkHealth);
  const [posForm, setPosForm] = useState(mkPos);
  const [goalForm, setGoalForm] = useState(mkGoal);
  const [cashForm, setCashForm] = useState(mkCash);
  const [listingForm, setListingForm] = useState(mkListing);
  const [loanForm, setLoanForm] = useState(mkLoan);
  const [debtForm, setDebtForm] = useState(mkDebt);
  const [divForm, setDivForm] = useState({ date: today(), amount: '', gross: true, note: '' });
  const [divInvId, setDivInvId] = useState(null);
  const [portfolioForm, setPortfolioForm] = useState(mkPortfolio);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [loadedPreferences, setLoadedPreferences] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const activeProfileIdRef = useRef(null);
  useEffect(() => { activeProfileIdRef.current = activeProfileId; }, [activeProfileId]);
  const dataLoaded = useRef(false);
  const saveTimer = useRef(null);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadUserData = useCallback(async (userId, profileId = null) => {
    try {
      let q = supabase.from('user_data').select('*').eq('user_id', userId);
      if (profileId != null) q = q.eq('profile_id', profileId);
      // When profileId is null, query without profile_id filter so it works
      // both before the migration (column absent) and after (column IS NULL).
      const { data } = await q.single();
      if (data) {
        let txs = data.transactions?.length ? data.transactions : [];

        // Auto-generate missing recurring transactions
        const newRecurring = applyRecurrences(txs);
        if (newRecurring.length > 0) {
          txs = [...txs, ...newRecurring];
          newRecurring.slice(0, 3).forEach(t => {
            const month = t.date.slice(0, 7);
            const srcId = t.recurrentSourceId || t.id;
            notifyOnce(`recur_${srcId}_${month}`, 'Transaction récurrente ajoutée', `${t.label} — ${t.amount > 0 ? '+' : ''}${fEur(t.amount)}`);
          });
          if (newRecurring.length > 3) {
            const month = newRecurring[0].date.slice(0, 7);
            notifyOnce(`recur_batch_${month}`, 'Transactions récurrentes', `${newRecurring.length} transactions ajoutées automatiquement`);
          }
        }

        setTransactions(txs);
        if (data.investments?.length) setInvestments(data.investments);
        if (data.health_assets?.length) setHealthAssets(data.health_assets);
        if (data.budgets && Object.keys(data.budgets).length) setBudgets(data.budgets);
        if (data.custom_budgets?.length) setCustomBudgets(data.custom_budgets);
        if (data.goals?.length) setGoals(data.goals);
        if (data.savings?.length) setSavings(data.savings);
        if (data.listings?.length) setListings(data.listings);
        if (data.sold_history?.length) setSoldHistory(data.sold_history);
        if (data.loans?.length) setLoans(data.loans);
        if (data.debts?.length) setDebts(data.debts);
        if (data.proj_years) setProjYears(data.proj_years);
        if (data.proj_rate) setProjRate(data.proj_rate);
        if (data.proj_monthly !== undefined) setProjMonthly(data.proj_monthly);
        if (data.preferences && typeof data.preferences === 'object') setLoadedPreferences(data.preferences);
      }
    } catch {}
    dataLoaded.current = true;
    setAuthLoading(false);
  }, []);

  const loadProfiles = useCallback(async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).order('created_at');
      setProfiles(data || []);
    } catch {}
  }, []);

  const switchProfile = useCallback(async (profileId) => {
    setTransactions([]); setInvestments([]); setHealthAssets([]);
    setBudgets(SEED_BUDGETS); setCustomBudgets([]); setGoals([]); setSavings([]);
    setListings([]); setSoldHistory([]);
    setLoans([]); setDebts([]);
    setActiveProfileId(profileId);
    activeProfileIdRef.current = profileId;
    dataLoaded.current = false;
    if (userRef.current) await loadUserData(userRef.current.id, profileId);
  }, [loadUserData]);

  const addProfile = useCallback(async (label) => {
    if (!userRef.current || !label.trim()) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ user_id: userRef.current.id, label: label.trim() })
        .select()
        .single();
      if (error || !data) return;
      setProfiles(p => [...p, data]);
      await switchProfile(data.id);
    } catch {}
  }, [switchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) { loadUserData(u.id); loadProfiles(u.id); }
      else setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) { setDemoMode(false); dataLoaded.current = false; setActiveProfileId(null); loadUserData(u.id); loadProfiles(u.id); registerPush(u.id); }
      else { dataLoaded.current = false; setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadUserData, loadProfiles]);

  useEffect(() => {
    if (!userRef.current || !dataLoaded.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const profileId = activeProfileIdRef.current;
        const payload = {
          user_id: userRef.current.id,
          transactions, investments, health_assets: healthAssets,
          budgets, custom_budgets: customBudgets, goals, savings, listings, sold_history: soldHistory,
          loans, debts,
          proj_years: projYears, proj_rate: projRate, proj_monthly: projMonthly,
          updated_at: new Date().toISOString(),
        };
        if (profileId != null) {
          const { data: existing, error: selErr } = await supabase.from('user_data').select('user_id').eq('user_id', userRef.current.id).eq('profile_id', profileId).maybeSingle();
          if (selErr) { console.error('SAVE ERROR (select):', selErr); return; }
          if (existing) {
            const { error: updErr } = await supabase.from('user_data').update(payload).eq('user_id', userRef.current.id).eq('profile_id', profileId);
            if (updErr) console.error('SAVE ERROR (update):', updErr);
          } else {
            const { error: insErr } = await supabase.from('user_data').insert({ ...payload, profile_id: profileId });
            if (insErr) console.error('SAVE ERROR (insert):', insErr);
          }
        } else {
          const { error: upsErr } = await supabase.from('user_data').upsert(payload, { onConflict: 'user_id' });
          if (upsErr) console.error('SAVE ERROR (upsert):', upsErr);
        }
      } catch (e) {
        console.error('SAVE ERROR:', e);
      }
    }, 1500);
  }, [transactions, investments, healthAssets, budgets, customBudgets, goals, savings, listings, soldHistory, loans, debts, projYears, projRate, projMonthly]);

  const handleLogout = async () => {
    dataLoaded.current = false;
    setDemoMode(false);
    setProfiles([]);
    setActiveProfileId(null);
    clearSentNotifications();
    await supabase.auth.signOut();
    setTransactions([]); setInvestments([]); setHealthAssets([]);
    setBudgets(SEED_BUDGETS); setCustomBudgets([]); setGoals([]); setSavings([]);
    setListings([]); setSoldHistory([]);
    setLoans([]); setDebts([]);
  };

  const activateDemo = () => {
    setTransactions(SEED_TX); setInvestments(SEED_INV); setHealthAssets(SEED_HEALTH);
    setBudgets(SEED_BUDGETS); setCustomBudgets([]); setGoals(SEED_GOALS); setSavings(SEED_CASH);
    setListings(SEED_LISTINGS); setSoldHistory([]);
    setLoans([]); setDebts([]);
    setDemoMode(true);
  };

  // ── Prices ────────────────────────────────────────────────────────────────
  const [prices, setPrices] = useState({});
  const [priceStatus, setPriceStatus] = useState('idle');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const invRef = useRef(investments);
  useEffect(() => { invRef.current = investments; }, [investments]);

  const fetchPrices = useCallback(async () => {
    const stockKeys = invRef.current.flatMap(inv =>
      (inv.positions || [])
        .filter(p => p.posType !== 'other' && p.posType !== 'realestate')
        .map(p => p.isin || p.ticker).filter(Boolean)
    );
    const commodityKeys = invRef.current.flatMap(inv =>
      (inv.positions || [])
        .filter(p => p.posType === 'commodity')
        .map(p => COMMODITY_TICKER_MAP[p.commodityType])
        .filter(Boolean)
    );
    const keys = [...new Set([...stockKeys, ...commodityKeys])];
    if (!keys.length) return;
    setPriceStatus('loading');
    try {
      const { data: rows, error } = await supabase
        .from('prices_cache')
        .select('ticker, price')
        .in('ticker', keys);
      if (error) throw new Error(error.message);
      const priceObj = {};
      for (const row of rows || []) priceObj[row.ticker] = row.price;
      setPrices(priceObj); setLastUpdated(new Date()); setPriceStatus('ok');
    } catch { setPriceStatus('error'); }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // Accepts either an ISIN (IE00B4L5Y983) or a ticker (BTC, CW8.PA)
  const fetchTickerPrice = useCallback(async (key) => {
    if (!key) return;
    setFetchingPrice(true);
    try {
      const res = await fetch(`${API_BASE}/api/price/${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.price != null) setPosForm(p => ({ ...p, currentPrice: String(Math.round(data.price * 100) / 100) }));
    } catch {}
    setFetchingPrice(false);
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const invLiveValue = inv => {
    const cash = parseFloat(inv.cash) || 0;
    if (inv.type === 'Immobilier' || !inv.positions?.length) return (parseFloat(inv.value) || 0) + cash;
    const v = inv.positions.reduce((s, p) => {
      if (p.posType === 'commodity') {
        const ticker = COMMODITY_TICKER_MAP[p.commodityType];
        const rawPrice = ticker ? prices[ticker] : null;
        if (rawPrice != null) {
          return s + p.shares * rawPrice * commodityUnitFactor(p.commodityType, p.unit);
        }
      }
      // posType 'other' (RealT wallet tokens) and 'realestate': currentPrice is already
      // the per-token EUR price — never override with a live feed that would cause
      // double-multiplication (shares × totalEUR instead of shares × priceEUR).
      if (p.posType === 'other' || p.posType === 'realestate') {
        return s + p.shares * p.currentPrice;
      }
      return s + p.shares * (prices[p.isin || p.ticker] ?? p.currentPrice);
    }, 0);
    return (v > 0 ? Math.round(v) : (parseFloat(inv.value) || 0)) + cash;
  };

  const invLiveInvested = inv => {
    if (inv.positions?.length) return inv.positions.reduce((s, p) => s + p.shares * p.buyPrice, 0);
    return parseFloat(inv.invested) || 0;
  };

  const allAccounts = [
    ...savings.map(a => ({ id: a.id, name: a.name, accountType: 'savings' })),
    ...investments.map(a => ({ id: a.id, name: a.name, accountType: 'investment' })),
  ];

  const txAccountDelta = (accountId) =>
    transactions
      .filter(t => t.accountId === accountId || t.destAccountId === accountId)
      .reduce((sum, t) => {
        const amt = Math.abs(t.amount);
        if (t.accountId === accountId) {
          if (t.type === 'income') return sum + amt;
          if (t.type === 'expense' || t.type === 'loan_repayment' || t.type === 'transfer') return sum - amt;
        }
        if (t.destAccountId === accountId && t.type === 'transfer') return sum + amt;
        return sum;
      }, 0);

  const computedSavings = savings.map(a => ({
    ...a,
    computedBalance: a.balance + txAccountDelta(a.id),
  }));

  const computedLoans = loans.map(l => ({
    ...l,
    computedRemaining: Math.max(0,
      (parseFloat(l.capitalRemaining) || 0) -
      transactions
        .filter(t => t.type === 'loan_repayment' && t.loanId === l.id)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    ),
  }));

  const invTotal    = investments.reduce((s, inv) => s + invLiveValue(inv), 0);
  const invInvested = investments.reduce((s, i) => s + invLiveInvested(i), 0);
  const healthTotal = healthAssets.reduce((s, h) => s + h.currentValue, 0) + listings.reduce((s, l) => s + (parseFloat(l.sellPrice) || parseFloat(l.buyPrice) || 0), 0);
  const healthCost  = healthAssets.reduce((s, h) => s + h.buyPrice, 0) + listings.reduce((s, l) => s + (parseFloat(l.buyPrice) || 0), 0);
  const cashTotal   = computedSavings.reduce((s, c) => s + c.computedBalance, 0);
  const annualInterests = computedSavings.reduce((s, c) => s + c.computedBalance * (c.rate / 100), 0);
  const avgRate    = cashTotal > 0 ? (annualInterests / cashTotal) * 100 : 0;
  const listingsExpectedProfit = listings.reduce((s, l) => s + (l.sellPrice - l.buyPrice - (l.fees || 0)), 0);
  const soldProfit = soldHistory.reduce((s, x) => s + x.profit, 0);
  const patrimoine = invTotal + cashTotal + healthTotal;
  const pnlTotal   = (invTotal - invInvested) + (healthTotal - healthCost);

  const totalLoanDebt     = computedLoans.reduce((s, l) => s + l.computedRemaining, 0);
  // Debt explicitly linked to an investment (immo loanId) — used for net patrimoine
  const linkedLoanDebt = investments
    .filter(inv => inv.loanId)
    .reduce((s, inv) => {
      const loan = computedLoans.find(l => l.id === inv.loanId);
      return s + (loan?.computedRemaining || 0);
    }, 0);
  const patrimoineNet = patrimoine - linkedLoanDebt;
  const totalConsumerDebt = debts.reduce((s, d) => s + (parseFloat(d.capitalRemaining) || 0), 0);
  const totalDebt         = totalLoanDebt + totalConsumerDebt;
  const monthlyLoanPayments = loans.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0) + (parseFloat(l.insuranceAmount) || 0), 0);
  const monthlyDebtPayments = monthlyLoanPayments + debts.reduce((s, d) => s + (parseFloat(d.monthlyPayment) || 0), 0);

  const now = new Date();
  const cm = now.getMonth(), cy = now.getFullYear();
  const soldProfitThisYear = soldHistory.filter(x => x.soldDate?.startsWith(String(cy))).reduce((s, x) => s + x.profit, 0);
  const monthTx = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === cm && d.getFullYear() === cy; });
  const income  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = Math.abs(monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const balance = income - expense;
  const savingsRate   = income > 0 ? (balance / income) * 100 : 0;
  const endettementRate = income > 0 ? (monthlyDebtPayments / income) * 100 : 0;

  const budgetProgress = {};
  Object.keys(budgets).forEach(cat => {
    const spent = Math.abs(monthTx.filter(t => t.category === cat && t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    budgetProgress[cat] = { spent, limit: budgets[cat], pct: budgets[cat] > 0 ? (spent / budgets[cat]) * 100 : 0 };
  });
  customBudgets.forEach(cb => {
    const limit = parseFloat(cb.limit) || 0;
    const spent = Math.abs(monthTx.filter(t => t.category === cb.name && t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    budgetProgress[cb.name] = { spent, limit, pct: limit > 0 ? (spent / limit) * 100 : 0, custom: true, icon: cb.icon, color: cb.color };
  });

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(cy, cm - 5 + i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    const txs = transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === m && td.getFullYear() === y; });
    const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = Math.abs(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    return { month: MONTHS[m], Revenus: inc, Dépenses: exp, Épargne: Math.max(0, inc - exp) };
  });

  const catMap = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value, color: CAT_COLORS[name] || '#94a3b8' }));

  const projData = Array.from({ length: projYears + 1 }, (_, i) => {
    const r = projRate / 100;
    const future = patrimoine * Math.pow(1 + r, i) + (r > 0 ? projMonthly * 12 * (Math.pow(1 + r, i) - 1) / r : projMonthly * 12 * i);
    return { year: `+${i}a`, Projection: Math.round(future), Base: Math.round(patrimoine + projMonthly * 12 * i) };
  });

  const diversif = [...new Set(investments.map(i => i.category))].length;
  const emergencyMonths = expense > 0 ? cashTotal / expense : 0;
  const debtRatio = patrimoine > 0 ? totalDebt / patrimoine : 0;

  let consecutiveSavingsMonths = 0;
  for (let i = monthlyData.length - 1; i >= 0; i--) {
    if (monthlyData[i].Épargne > 0) consecutiveSavingsMonths++;
    else break;
  }

  const score = calcScore({ savingsRate, diversif, emergencyMonths, debtRatio, consecutiveSavingsMonths });

  const alerts = [];
  Object.entries(budgetProgress).forEach(([cat, { pct, spent, limit }]) => {
    if (pct >= 90) alerts.push({ msg: `Budget ${cat} : ${Math.round(pct)}% utilisé (${fEur(spent)} / ${fEur(limit)})` });
  });
  if (income > 0 && endettementRate > 33) {
    alerts.push({ msg: `Taux d'endettement : ${endettementRate.toFixed(0)}% de vos revenus — limite légale 33%` });
  }

  // ── Dividend computed ─────────────────────────────────────────────────────
  const allDividends = investments.flatMap(inv => (inv.dividends || []).map(d => ({ ...d, invName: inv.name, invId: inv.id })));
  const divThisYear = allDividends.filter(d => d.date.startsWith(String(cy))).reduce((s, d) => s + d.amount, 0);
  const divByMonth = Array.from({ length: 12 }, (_, m) => ({
    month: MONTHS[m],
    Dividendes: allDividends.filter(d => d.date.startsWith(`${cy}-${String(m + 1).padStart(2, '0')}`)).reduce((s, d) => s + d.amount, 0),
  }));

  // ── Budget & goal notifications ───────────────────────────────────────────
  useEffect(() => {
    if (!dataLoaded.current) return;
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    Object.entries(budgetProgress).forEach(([cat, { pct }]) => {
      if (pct >= 100) notifyOnce(`budget_${cat}_100_${month}`, 'Budget dépassé !', `Budget ${cat} à ${Math.round(pct)}% — limite atteinte`);
      else if (pct >= 80) notifyOnce(`budget_${cat}_80_${month}`, 'Budget à 80%', `Budget ${cat} à ${Math.round(pct)}% de la limite`);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, budgets]);

  // ── Reminder: no data entered for 3+ days ────────────────────────────────
  const reminderChecked = useRef(false);
  useEffect(() => {
    if (!transactions.length || reminderChecked.current) return;
    reminderChecked.current = true;
    checkReminderNotif(transactions, setIoBannerMsg);
  }, [transactions]);

  // ── Daily 20h performance notification (checks every 30 min) ─────────────
  const dailyCtxRef = useRef({});
  dailyCtxRef.current = { transactions, invTotal };
  useEffect(() => {
    const run = () => {
      if (!dataLoaded.current) return;
      checkAndSendDailyNotif(dailyCtxRef.current, setIoBannerMsg);
    };
    run();
    const id = setInterval(run, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dataLoaded.current) return;
    goals.forEach(g => {
      if (patrimoine >= g.target) {
        notifyOnce(`goal_${g.id}`, 'Objectif atteint !', `Félicitations ! "${g.name}" (${fEur(g.target)}) est atteint.`);
      }
    });
  }, [goals, patrimoine]);

  // ── Patrimoine snapshot (every 30min when app is open) ───────────────────
  useEffect(() => {
    if (!user || !dataLoaded.current || patrimoine <= 0) return;
    const now = Date.now();
    const last = parseInt(localStorage.getItem('lastPatrimoineSnapshot') || '0', 10);
    if (now - last < 1800000) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch('/api/cron-prices?action=snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ valeur: Math.round(patrimoine) }),
      }).then(r => {
        if (r.ok) localStorage.setItem('lastPatrimoineSnapshot', String(now));
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, patrimoine]);

  // ── Cash-flow forecast ────────────────────────────────────────────────────
  const computeForecast = useCallback((days) => {
    const originals = transactions.filter(t => t.recurrent && !t.recurrentSourceId);
    let bal = cashTotal;
    const points = [{ label: "Auj.", balance: Math.round(bal), neg: bal < 0 }];

    const checkpoints = new Set([1, 7, 14, 21, 30, 45, 60, 75, 90, days]);
    for (let d = 1; d <= days; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      const yyyy = dt.getFullYear();
      const mm   = String(dt.getMonth() + 1).padStart(2, '0');
      const dayNum = dt.getDate();
      const monthStr = `${yyyy}-${mm}`;

      let dayDelta = 0;
      originals.forEach(orig => {
        const origDay = parseInt(orig.date.slice(8, 10), 10);
        if (dayNum === origDay) {
          const exists = transactions.some(t =>
            (t.id === orig.id || t.recurrentSourceId === orig.id) && t.date.startsWith(monthStr)
          );
          if (!exists) dayDelta += orig.amount;
        }
      });
      bal += dayDelta;

      if (checkpoints.has(d)) {
        points.push({ label: `J+${d}`, balance: Math.round(bal), neg: bal < 0 });
      }
    }
    return points;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, cashTotal]);

  // ── CSV import ────────────────────────────────────────────────────────────
  const importTransactions = useCallback((rows) => {
    const newTxs = rows
      .filter(r => !transactions.some(
        t => t.date === r.date && Math.abs(t.amount) === Math.abs(r.amount) && t.label === r.label
      ))
      .map(r => ({
        id: uid(),
        date: r.date,
        label: r.label,
        category: r.category,
        amount: r.amount,
        type: r.amount > 0 ? 'income' : 'expense',
        recurrent: false,
        accountId: '',
        destAccountId: '',
        loanId: '',
      }));
    setTransactions(p => [...newTxs, ...p]);
    return newTxs.length;
  }, [transactions]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const saveTx = () => {
    if (!txForm.date || !txForm.label || !txForm.amount) return;
    const amt = parseFloat(txForm.amount);
    let amount, category;
    if (txForm.type === 'transfer') {
      amount = Math.abs(amt); category = 'Virement';
    } else if (txForm.type === 'loan_repayment') {
      amount = Math.abs(amt); category = 'Remboursement';
    } else {
      amount = txForm.type === 'expense' ? -Math.abs(amt) : Math.abs(amt);
      category = txForm.category;
    }
    const item = { ...txForm, id: editItem?.id || uid(), amount, category };
    setTransactions(p => editItem ? p.map(t => t.id === editItem.id ? item : t) : [item, ...p]);
    setTxForm(mkTx()); setEditItem(null); setModal(null);
  };
  const delTx = id => setTransactions(p => p.filter(t => t.id !== id));
  const openEditTx = t => { setEditItem(t); setTxForm({ ...t, amount: Math.abs(t.amount) }); setModal('tx'); };

  const saveInv = () => {
    if (!invForm.name || !invForm.value || !invForm.invested) return;
    const idx = investments.findIndex(i => i.id === editItem?.id);
    const item = { ...invForm, id: editItem?.id || uid(), value: parseFloat(invForm.value), invested: parseFloat(invForm.invested), color: editItem?.color || INV_COLORS[investments.length % INV_COLORS.length], positions: editItem?.positions || [], dividends: editItem?.dividends || [] };
    setInvestments(p => idx >= 0 ? p.map((x, i) => i === idx ? item : x) : [...p, item]);
    setInvForm(mkInv()); setEditItem(null); setModal(null);
  };
  const delInv = id => setInvestments(p => p.filter(i => i.id !== id));
  const openEditInv = inv => { setEditItem(inv); setInvForm({ name: inv.name, category: inv.category, value: inv.value, invested: inv.invested, notes: inv.notes || '' }); setModal('inv'); };

  const savePortfolio = () => {
    if (!portfolioForm.name) return;
    const color = editItem?.color || PORTFOLIO_TYPE_COLOR[portfolioForm.type] || INV_COLORS[investments.length % INV_COLORS.length];
    const item = {
      ...(editItem?.category ? { category: editItem.category } : {}),
      ...portfolioForm,
      id: editItem?.id || uid(),
      color,
      value: parseFloat(portfolioForm.value) || 0,
      invested: parseFloat(portfolioForm.invested) || 0,
      cash: parseFloat(portfolioForm.cash) || 0,
      loyerMensuel: parseFloat(portfolioForm.loyerMensuel) || 0,
      chargesMensuelles: parseFloat(portfolioForm.chargesMensuelles) || 0,
      positions: editItem?.positions || [],
      dividends: editItem?.dividends || [],
    };
    setInvestments(p => editItem ? p.map(i => i.id === editItem.id ? item : i) : [...p, item]);
    setPortfolioForm(mkPortfolio()); setEditItem(null); setModal(null);
  };
  const openEditPortfolio = inv => {
    setEditItem(inv);
    setPortfolioForm({
      name: inv.name, type: inv.type || CAT_TO_PORTFOLIO_TYPE[inv.category] || 'Autre',
      courtier: inv.courtier || '', openDate: inv.openDate || '', devise: inv.devise || 'EUR',
      assureur: inv.assureur || '', avType: inv.avType || 'Fonds euros',
      platform: inv.platform || '', walletType: inv.walletType || 'CEX',
      immoBien: inv.immoBien || 'Locatif', adresse: inv.adresse || '',
      acquisitionDate: inv.acquisitionDate || '', loanId: inv.loanId || '',
      loyerMensuel: inv.loyerMensuel || '', chargesMensuelles: inv.chargesMensuelles || '',
      employeur: inv.employeur || '', peType: inv.peType || 'PEE',
      disponibiliteDate: inv.disponibiliteDate || '',
      value: inv.value || '', invested: inv.invested || '', cash: inv.cash || '', notes: inv.notes || '',
    });
    setModal('portfolio');
  };

  const saveHealth = () => {
    if (!healthForm.name || !healthForm.currentValue || !healthForm.buyPrice) return;
    const item = { ...healthForm, id: editItem?.id || uid(), buyPrice: parseFloat(healthForm.buyPrice), currentValue: parseFloat(healthForm.currentValue) };
    setHealthAssets(p => editItem ? p.map(h => h.id === editItem.id ? item : h) : [...p, item]);
    setHealthForm(mkHealth()); setEditItem(null); setModal(null);
  };
  const delHealth = id => setHealthAssets(p => p.filter(h => h.id !== id));
  const openEditHealth = h => { setEditItem(h); setHealthForm(h); setModal('health'); };

  const savePosition = () => {
    const ft = posForm.posType || 'stock';
    const noIdNeeded = ft === 'realestate' || ft === 'bond' || ft === 'commodity';
    if (!noIdNeeded && !(posForm.isin || posForm.ticker)) return;
    const rawShares = noIdNeeded && !posForm.shares ? '1' : posForm.shares;
    if (!rawShares || !posForm.buyPrice) return;
    const liveKey = posForm.isin || posForm.ticker;
    const livePrc = liveKey ? prices[liveKey] : undefined;
    const currentPrice = parseFloat(posForm.currentPrice) || livePrc || 0;
    const pos = { ...posForm, id: editItem?.posId || uid(), shares: parseFloat(rawShares), buyPrice: parseFloat(posForm.buyPrice), currentPrice, divYield: parseFloat(posForm.divYield) || 0 };
    setInvestments(p => p.map(inv => {
      if (inv.id !== drillInv?.id) return inv;
      const positions = editItem?.posId ? inv.positions.map(x => x.id === editItem.posId ? pos : x) : [...(inv.positions || []), pos];
      return { ...inv, positions };
    }));
    setPosForm(mkPos()); setEditItem(null); setModal(null);
  };

  const saveListing = () => {
    if (!listingForm.name || listingForm.buyPrice === '' || listingForm.sellPrice === '') return;
    const item = { ...listingForm, id: editItem?.id || uid(), buyPrice: parseFloat(listingForm.buyPrice) || 0, sellPrice: parseFloat(listingForm.sellPrice) || 0, fees: parseFloat(listingForm.fees) || 0 };
    setListings(p => editItem ? p.map(l => l.id === editItem.id ? item : l) : [...p, item]);
    setListingForm(mkListing()); setEditItem(null); setModal(null);
  };
  const delListing = id => setListings(p => p.filter(l => l.id !== id));
  const openEditListing = l => { setEditItem(l); setListingForm(l); setModal('listing'); };
  const markSold = listing => {
    const profit = (parseFloat(listing.sellPrice) || 0) - (parseFloat(listing.buyPrice) || 0) - (parseFloat(listing.fees) || 0);
    setSoldHistory(p => [{ ...listing, profit, soldDate: today() }, ...p]);
    setListings(p => p.filter(l => l.id !== listing.id));
  };

  const saveCash = () => {
    if (!cashForm.name || cashForm.balance === '') return;
    const item = { ...cashForm, id: editItem?.id || uid(), balance: parseFloat(cashForm.balance) || 0, rate: parseFloat(cashForm.rate) || 0 };
    setSavings(p => editItem ? p.map(c => c.id === editItem.id ? item : c) : [...p, item]);
    setCashForm(mkCash()); setEditItem(null); setModal(null);
  };
  const delCash = id => setSavings(p => p.filter(c => c.id !== id));
  const openEditCash = c => { setEditItem(c); setCashForm(c); setModal('cash'); };

  const saveGoal = () => {
    if (!goalForm.name || !goalForm.target || !goalForm.deadline) return;
    const item = { ...goalForm, id: editItem?.id || uid(), target: parseFloat(goalForm.target) };
    setGoals(p => editItem ? p.map(g => g.id === editItem.id ? item : g) : [...p, item]);
    setGoalForm(mkGoal()); setEditItem(null); setModal(null);
  };
  const delGoal = id => setGoals(p => p.filter(g => g.id !== id));

  const saveCustomBudget = () => {
    if (!customBudgetForm.name.trim()) return;
    const item = { ...customBudgetForm, id: editItem?.id || uid(), limit: parseFloat(customBudgetForm.limit) || 0 };
    setCustomBudgets(p => editItem ? p.map(cb => cb.id === editItem.id ? item : cb) : [...p, item]);
    setCustomBudgetForm(mkCustomBudget()); setEditItem(null); setModal(null);
  };
  const delCustomBudget = id => setCustomBudgets(p => p.filter(cb => cb.id !== id));
  const openEditCustomBudget = cb => { setEditItem(cb); setCustomBudgetForm(cb); setModal('customBudget'); };

  const saveLoan = () => {
    if (!loanForm.name || !loanForm.capitalRemaining) return;
    const item = {
      ...loanForm, id: editItem?.id || uid(),
      capitalBorrowed: parseFloat(loanForm.capitalBorrowed) || 0,
      capitalRemaining: parseFloat(loanForm.capitalRemaining) || 0,
      monthlyPayment: parseFloat(loanForm.monthlyPayment) || 0,
      rate: parseFloat(loanForm.rate) || 0,
      insuranceAmount: parseFloat(loanForm.insuranceAmount) || 0,
      insuranceRate: parseFloat(loanForm.insuranceRate) || 0,
    };
    setLoans(p => editItem ? p.map(l => l.id === editItem.id ? item : l) : [...p, item]);
    setLoanForm(mkLoan()); setEditItem(null); setModal(null);
  };
  const delLoan = id => setLoans(p => p.filter(l => l.id !== id));
  const openEditLoan = l => { setEditItem(l); setLoanForm(l); setModal('loan'); };

  const saveDebt = () => {
    if (!debtForm.name || !debtForm.capitalRemaining) return;
    const item = {
      ...debtForm, id: editItem?.id || uid(),
      capitalRemaining: parseFloat(debtForm.capitalRemaining) || 0,
      monthlyPayment: parseFloat(debtForm.monthlyPayment) || 0,
      rate: parseFloat(debtForm.rate) || 0,
    };
    setDebts(p => editItem ? p.map(d => d.id === editItem.id ? item : d) : [...p, item]);
    setDebtForm(mkDebt()); setEditItem(null); setModal(null);
  };
  const delDebt = id => setDebts(p => p.filter(d => d.id !== id));
  const openEditDebt = d => { setEditItem(d); setDebtForm(d); setModal('debt'); };

  const addDividend = (invId, div) => {
    if (!div.amount) return;
    const item = { id: uid(), date: div.date, amount: parseFloat(div.amount) || 0, gross: div.gross, note: div.note || '' };
    setInvestments(p => p.map(inv => inv.id !== invId ? inv : { ...inv, dividends: [...(inv.dividends || []), item] }));
  };
  const delDividend = (invId, divId) => {
    setInvestments(p => p.map(inv => inv.id !== invId ? inv : { ...inv, dividends: (inv.dividends || []).filter(d => d.id !== divId) }));
  };

  const exportCSV = () => {
    const rows = [['Date', 'Libellé', 'Catégorie', 'Type', 'Montant'], ...transactions.map(t => [t.date, t.label, t.category, t.type, t.amount])];
    const csv = rows.map(r => r.join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'transactions.csv';
    a.click();
  };

  const exportDataJSON = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions, investments, savings, health_assets: healthAssets,
      loans, debts, goals, listings, sold_history: soldHistory,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `capitaly-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importJSON = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.transactions?.length)   setTransactions(d.transactions);
        if (d.investments?.length)    setInvestments(d.investments);
        if (d.savings?.length)        setSavings(d.savings);
        if (d.health_assets?.length)  setHealthAssets(d.health_assets);
        if (d.loans?.length)          setLoans(d.loans);
        if (d.debts?.length)          setDebts(d.debts);
        if (d.goals?.length)          setGoals(d.goals);
        if (d.listings?.length)       setListings(d.listings);
        if (d.sold_history?.length)   setSoldHistory(d.sold_history);
        resolve(true);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

  const savePreferences = useCallback(async (prefs) => {
    if (!userRef.current) return;
    try {
      await supabase.from('user_data').update({ preferences: prefs, updated_at: new Date().toISOString() }).eq('user_id', userRef.current.id);
    } catch {}
  }, []);

  const deleteAccount = async () => {
    if (!userRef.current) return;
    await supabase.from('user_data').delete().eq('user_id', userRef.current.id);
    await supabase.auth.signOut();
    dataLoaded.current = false;
    setTransactions([]); setInvestments([]); setHealthAssets([]);
    setBudgets(SEED_BUDGETS); setCustomBudgets([]); setGoals([]); setSavings([]);
    setListings([]); setSoldHistory([]);
    setLoans([]); setDebts([]);
    setUser(null);
  };

  return {
    user, authLoading, demoMode, handleLogout, activateDemo,
    transactions, investments, healthAssets, budgets, setBudgets,
    goals, savings, computedSavings, listings, soldHistory, setSoldHistory,
    loans, computedLoans, debts,
    allAccounts,
    projYears, setProjYears, projRate, setProjRate, projMonthly, setProjMonthly,
    prices, priceStatus, lastUpdated, fetchPrices, fetchingPrice, fetchTickerPrice,
    modal, setModal, editItem, setEditItem, drillInv, setDrillInv,
    txForm, setTxForm, invForm, setInvForm, healthForm, setHealthForm,
    posForm, setPosForm, goalForm, setGoalForm, cashForm, setCashForm,
    listingForm, setListingForm, loanForm, setLoanForm, debtForm, setDebtForm,
    mkTx, mkInv, mkHealth, mkPos, mkGoal, mkCash, mkListing, mkLoan, mkDebt, mkPortfolio,
    patrimoine, patrimoineNet, linkedLoanDebt,
    invTotal, invInvested, cashTotal, healthTotal, healthCost,
    annualInterests, avgRate,
    listingsBuyTotal: listings.reduce((s, l) => s + l.buyPrice, 0),
    listingsSellTotal: listings.reduce((s, l) => s + l.sellPrice, 0),
    listingsExpectedProfit, soldProfit, soldProfitThisYear,
    income, expense, balance, savingsRate, pnlTotal,
    totalLoanDebt, totalConsumerDebt, totalDebt, monthlyDebtPayments, endettementRate,
    score, alerts, budgetProgress, monthlyData, catData, projData,
    invLiveValue, invLiveInvested, setInvestments,
    computeForecast, importTransactions,
    saveTx, delTx, openEditTx,
    saveInv, delInv, openEditInv,
    savePortfolio, openEditPortfolio, portfolioForm, setPortfolioForm,
    saveHealth, delHealth, openEditHealth,
    savePosition,
    saveListing, delListing, openEditListing, markSold,
    saveCash, delCash, openEditCash,
    saveGoal, delGoal,
    customBudgets, customBudgetForm, setCustomBudgetForm, mkCustomBudget,
    saveCustomBudget, delCustomBudget, openEditCustomBudget,
    saveLoan, delLoan, openEditLoan,
    saveDebt, delDebt, openEditDebt,
    divForm, setDivForm, divInvId, setDivInvId,
    addDividend, delDividend,
    allDividends, divThisYear, divByMonth,
    exportCSV, exportDataJSON, importJSON, deleteAccount,
    loadedPreferences, savePreferences,
    profiles, activeProfileId, switchProfile, addProfile,
    ioBannerMsg, setIoBannerMsg,
  };
}
