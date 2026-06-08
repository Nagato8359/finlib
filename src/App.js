import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from './supabaseClient';

const API_BASE = process.env.REACT_APP_API_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fEur = (n, compact = false) => {
  if (compact && Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(".", ",") + "k €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
};
const fPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
const fDate = (d) => new Date(d).toLocaleDateString("fr-FR");
const fPrice = (n) => {
  if (n == null) return "—";
  const dec = n < 1 ? 6 : n < 100 ? 2 : 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: dec }).format(n);
};
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now() + Math.random().toString(36).slice(2);
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];

const CAT_COLORS = {
  Revenus:"#10b981", Logement:"#f87171", Alimentation:"#fb923c", Factures:"#a78bfa",
  Abonnements:"#60a5fa", Transport:"#34d399", Santé:"#f472b6", Loisirs:"#facc15",
  Épargne:"#4ade80", Autres:"#94a3b8",
};
const INV_CATS = ["Actions","Crypto","Obligataire","Immobilier","Épargne liquide","Autres"];
const INV_COLORS = ["#10b981","#f59e0b","#60a5fa","#a78bfa","#34d399","#f472b6","#fb923c","#facc15"];
const HEALTH_CATS = ["Voiture","Immobilier physique","Collection","Électronique","Mobilier","Bijoux","Autres"];
const CASH_TYPES = ["Compte courant","Livret A","LDD","PEL","CEL","Autre"];
const CASH_TYPE_COLORS = { "Compte courant":"#60a5fa", "Livret A":"#34d399", "LDD":"#4ade80", "PEL":"#a78bfa", "CEL":"#f472b6", "Autre":"#94a3b8" };
const LISTING_CATS = ["Objet physique","Crypto","Action","ETF"];
const LISTING_PLATFORMS = ["Vinted","eBay","LeBonCoin","Binance","Bourse Direct","Autre"];
const LISTING_CAT_COLORS = { "Objet physique":"#fb923c", "Crypto":"#f59e0b", "Action":"#10b981", "ETF":"#60a5fa" };
const LISTING_PLATFORM_ICONS = { "Vinted":"👗", "eBay":"🛍️", "LeBonCoin":"📦", "Binance":"🪙", "Bourse Direct":"📈", "Autre":"🏷️" };



// ── Default seeds ─────────────────────────────────────────────────────────────
const SEED_TX = [
  { id: uid(), date: "2026-06-01", label: "Salaire", category: "Revenus", amount: 2800, type: "income", recurrent: true },
  { id: uid(), date: "2026-06-02", label: "Loyer", category: "Logement", amount: -950, type: "expense", recurrent: true },
  { id: uid(), date: "2026-06-03", label: "Courses Leclerc", category: "Alimentation", amount: -120, type: "expense", recurrent: false },
  { id: uid(), date: "2026-06-05", label: "EDF", category: "Factures", amount: -85, type: "expense", recurrent: true },
  { id: uid(), date: "2026-06-06", label: "Netflix", category: "Abonnements", amount: -18, type: "expense", recurrent: true },
  { id: uid(), date: "2026-05-01", label: "Salaire", category: "Revenus", amount: 2800, type: "income", recurrent: true },
  { id: uid(), date: "2026-05-02", label: "Loyer", category: "Logement", amount: -950, type: "expense", recurrent: true },
  { id: uid(), date: "2026-05-10", label: "Restaurant", category: "Alimentation", amount: -65, type: "expense", recurrent: false },
  { id: uid(), date: "2026-05-15", label: "Freelance", category: "Revenus", amount: 450, type: "income", recurrent: false },
];
const SEED_INV = [
  { id: uid(), name: "PEA — ETF World", category: "Actions", value: 12400, invested: 10000, color: "#10b981", positions: [
    { id: uid(), ticker: "CW8", name: "Amundi MSCI World", shares: 40, buyPrice: 280, currentPrice: 310 },
    { id: uid(), ticker: "WPEA", name: "iShares Core MSCI World", shares: 20, buyPrice: 68, currentPrice: 74 },
  ]},
  { id: uid(), name: "Bitcoin (BTC)", category: "Crypto", value: 8200, invested: 5000, color: "#f59e0b", positions: [
    { id: uid(), ticker: "BTC", name: "Bitcoin", shares: 0.12, buyPrice: 41667, currentPrice: 68333 },
  ]},
  { id: uid(), name: "Assurance-vie fonds €", category: "Obligataire", value: 5500, invested: 5200, color: "#60a5fa", positions: [] },
  { id: uid(), name: "RealT (immobilier)", category: "Immobilier", value: 1800, invested: 2000, color: "#a78bfa", positions: [] },
];
const SEED_HEALTH = [
  { id: uid(), name: "Renault Clio", category: "Voiture", buyPrice: 8000, currentValue: 5500, date: "2022-03-01", notes: "" },
  { id: uid(), name: "Collection Pop Figures", category: "Collection", buyPrice: 1200, currentValue: 1800, date: "2020-01-01", notes: "~60 figurines" },
  { id: uid(), name: "Collection Yugioh", category: "Collection", buyPrice: 800, currentValue: 1200, date: "2019-06-01", notes: "Cartes rares" },
];
const SEED_BUDGETS = { Logement: 1000, Alimentation: 400, Transport: 150, Loisirs: 200, Abonnements: 80, Factures: 150, Santé: 100, Autres: 200 };
const SEED_GOALS = [
  { id: uid(), name: "Indépendance financière", target: 300000, deadline: "2035-01-01", color: "#10b981" },
  { id: uid(), name: "Achat immobilier", target: 50000, deadline: "2029-01-01", color: "#60a5fa" },
];
const SEED_CASH = [
  { id: uid(), name: "Compte courant BNP", type: "Compte courant", balance: 2500, rate: 0 },
  { id: uid(), name: "Livret A", type: "Livret A", balance: 7500, rate: 3.0 },
  { id: uid(), name: "LDD Société Générale", type: "LDD", balance: 4000, rate: 2.4 },
];
const SEED_LISTINGS = [
  { id: uid(), name: "iPhone 13 Pro 256 Go", category: "Objet physique", platform: "eBay", buyPrice: 650, sellPrice: 520, fees: 30, listedDate: "2026-05-15", notes: "Bon état, avec boîte" },
  { id: uid(), name: "0.05 ETH", category: "Crypto", platform: "Binance", buyPrice: 90, sellPrice: 125, fees: 3, listedDate: "2026-06-01", notes: "" },
];
const SEED_SOLD = [];

// ── Styled atoms ──────────────────────────────────────────────────────────────
const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 24px" };
const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f1f5f9", padding: "9px 12px", fontSize: 13, outline: "none", width: "100%", fontFamily: "inherit" };
const btnG = { background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnS = { ...btnG, background: "rgba(255,255,255,0.07)" };
const btnD = { ...btnG, background: "rgba(248,113,113,0.15)", color: "#f87171" };

const Label = ({ children }) => <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>{children}</label>;
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
    <div style={{ color: "#6b7280", marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fEur(p.value)}</div>)}
  </div>;
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, accent, icon }) => (
  <div style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}
    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"}
    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</span>
      <span style={{ fontSize: 16 }}>{icon}</span>
    </div>
    <span style={{ fontSize: 24, fontWeight: 700, color: accent || "#f1f5f9", letterSpacing: "-.02em" }}>{value}</span>
    {sub && <span style={{ fontSize: 12, color: sub.startsWith("+") ? "#4ade80" : sub.startsWith("-") ? "#f87171" : "#6b7280" }}>{sub}</span>}
  </div>
);

// ── Modal wrapper ─────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", justifyContent: "center" }}>
    <div className="modal-box" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <button onClick={onClose} style={{ ...btnS, padding: "4px 10px", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

// ── Score de santé financière ─────────────────────────────────────────────────
const healthScore = (savingsRate, diversification, debtRatio) => {
  const s = Math.min(100, Math.max(0, savingsRate * 2));
  const d = Math.min(100, diversification * 20);
  const dr = Math.max(0, 100 - debtRatio * 2);
  return Math.round((s * 0.4 + d * 0.35 + dr * 0.25));
};

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Compte créé ! Vérifiez votre email pour activer votre compte.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const aInp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f1f5f9", padding: "10px 12px", fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const aLbl = { fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>◈</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" }}>FinLib</div>
          <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>Votre patrimoine, en clair</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h2>
          <form onSubmit={handle}>
            <div style={{ marginBottom: 14 }}>
              <label style={aLbl}>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" style={aInp} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={aLbl}>Mot de passe</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" style={aInp} />
            </div>
            {error && <div style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#f87171", marginBottom: 14 }}>{error}</div>}
            {success && <div style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#4ade80", marginBottom: 14 }}>{success}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 8, color: "#fff", padding: 11, fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
              {loading ? "…" : mode === "login" ? "Se connecter" : "Créer le compte"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#6b7280" }}>
            {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}
            <button onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); setSuccess(""); }}
              style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontWeight: 600, marginLeft: 6, fontFamily: "inherit", fontSize: 13 }}>
              {mode === "login" ? "S'inscrire" : "Se connecter"}
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={onDemo} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              Explorer sans compte — mode démo →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("overview");

  // State (vide pour les vrais utilisateurs — seeds uniquement en mode démo)
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [healthAssets, setHealthAssets] = useState([]);
  const [budgets, setBudgets] = useState(SEED_BUDGETS);
  const [goals, setGoals] = useState([]);
  const [savings, setSavings] = useState([]);
  const [listings, setListings] = useState([]);
  const [soldHistory, setSoldHistory] = useState([]);
  const [projYears, setProjYears] = useState(10);
  const [projRate, setProjRate] = useState(7);
  const [projMonthly, setProjMonthly] = useState(500);

  // Modals
  const [modal, setModal] = useState(null); // 'tx' | 'inv' | 'health' | 'position' | 'goal' | 'budget' | 'drill'
  const [editItem, setEditItem] = useState(null);
  const [drillInv, setDrillInv] = useState(null);

  // Forms
  const emptyTx = { date: today(), label: "", category: "Alimentation", amount: "", type: "expense", recurrent: false };
  const emptyInv = { name: "", category: "Actions", value: "", invested: "", notes: "" };
  const emptyHealth = { name: "", category: "Voiture", buyPrice: "", currentValue: "", date: today(), notes: "" };
  const emptyPos = { ticker: "", name: "", shares: "", buyPrice: "", currentPrice: "" };
  const emptyGoal = { name: "", target: "", deadline: "", color: "#10b981" };
  const emptyCash = { name: "", type: "Livret A", balance: "", rate: "" };
  const emptyListing = { name: "", category: "Objet physique", platform: "eBay", buyPrice: "", sellPrice: "", fees: "", listedDate: today(), notes: "" };
  const [txForm, setTxForm] = useState(emptyTx);
  const [invForm, setInvForm] = useState(emptyInv);
  const [healthForm, setHealthForm] = useState(emptyHealth);
  const [posForm, setPosForm] = useState(emptyPos);
  const [goalForm, setGoalForm] = useState(emptyGoal);
  const [cashForm, setCashForm] = useState(emptyCash);
  const [listingForm, setListingForm] = useState(emptyListing);

  // ── Auth & sync Supabase ─────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const dataLoaded = useRef(false);
  const saveTimer = useRef(null);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadUserData = useCallback(async (uid) => {
    try {
      const { data } = await supabase.from("user_data").select("*").eq("user_id", uid).single();
      if (data) {
        if (data.transactions?.length) setTransactions(data.transactions);
        if (data.investments?.length) setInvestments(data.investments);
        if (data.health_assets?.length) setHealthAssets(data.health_assets);
        if (data.budgets && Object.keys(data.budgets).length) setBudgets(data.budgets);
        if (data.goals?.length) setGoals(data.goals);
        if (data.savings?.length) setSavings(data.savings);
        if (data.listings?.length) setListings(data.listings);
        if (data.sold_history?.length) setSoldHistory(data.sold_history);
        if (data.proj_years) setProjYears(data.proj_years);
        if (data.proj_rate) setProjRate(data.proj_rate);
        if (data.proj_monthly !== undefined) setProjMonthly(data.proj_monthly);
      }
    } catch {}
    dataLoaded.current = true;
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadUserData(u.id);
      else setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) { setDemoMode(false); dataLoaded.current = false; loadUserData(u.id); }
      else { dataLoaded.current = false; setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadUserData]);

  useEffect(() => {
    if (!userRef.current || !dataLoaded.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("user_data").upsert({
        user_id: userRef.current.id,
        transactions, investments, health_assets: healthAssets,
        budgets, goals, savings, listings, sold_history: soldHistory,
        proj_years: projYears, proj_rate: projRate, proj_monthly: projMonthly,
        updated_at: new Date().toISOString(),
      });
    }, 1500);
  }, [transactions, investments, healthAssets, budgets, goals, savings, listings, soldHistory, projYears, projRate, projMonthly]);

  const handleLogout = async () => {
    dataLoaded.current = false;
    setDemoMode(false);
    await supabase.auth.signOut();
    setTransactions([]); setInvestments([]); setHealthAssets([]);
    setBudgets(SEED_BUDGETS); setGoals([]); setSavings([]);
    setListings([]); setSoldHistory([]);
  };

  // ── Prix en temps réel ────────────────────────────────────────────────────
  const [prices, setPrices] = useState({});
  const [priceStatus, setPriceStatus] = useState("idle");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const invRef = useRef(investments);
  useEffect(() => { invRef.current = investments; }, [investments]);

  const fetchPrices = useCallback(async () => {
    const tickers = [...new Set(
      invRef.current.flatMap(inv => (inv.positions || []).map(p => p.ticker).filter(Boolean))
    )];
    if (!tickers.length) return;
    setPriceStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/prices?tickers=${tickers.join(",")}`);
      if (!res.ok) throw new Error("server");
      const data = await res.json();
      setPrices(data);
      setLastUpdated(new Date());
      setPriceStatus("ok");
    } catch {
      setPriceStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  const fetchTickerPrice = useCallback(async (ticker) => {
    if (!ticker) return;
    setFetchingPrice(true);
    try {
      const res = await fetch(`${API_BASE}/api/price/${ticker}`);
      const data = await res.json();
      if (data.price != null) setPosForm(p => ({ ...p, currentPrice: String(Math.round(data.price * 100) / 100) }));
    } catch {}
    setFetchingPrice(false);
  }, []);

  // ── Computed ───────────────────────────────────────────────────────────────
  // Valeur live d'un investissement : calcul à partir de prices (sans toucher au state)
  const invLiveValue = (inv) => {
    if (!inv.positions?.length) return inv.value;
    const v = inv.positions.reduce((s, p) => s + p.shares * (prices[p.ticker] ?? p.currentPrice), 0);
    return v > 0 ? Math.round(v) : inv.value;
  };

  const invTotal = investments.reduce((s, inv) => s + invLiveValue(inv), 0);
  const invInvested = investments.reduce((s, i) => s + i.invested, 0);
  const healthTotal = healthAssets.reduce((s, h) => s + h.currentValue, 0);
  const healthCost = healthAssets.reduce((s, h) => s + h.buyPrice, 0);
  const cashTotal = savings.reduce((s, c) => s + c.balance, 0);
  const annualInterests = savings.reduce((s, c) => s + c.balance * (c.rate / 100), 0);
  const avgRate = cashTotal > 0 ? (annualInterests / cashTotal) * 100 : 0;
  const listingsBuyTotal = listings.reduce((s, l) => s + l.buyPrice, 0);
  const listingsSellTotal = listings.reduce((s, l) => s + l.sellPrice, 0);
  const listingsExpectedProfit = listings.reduce((s, l) => s + (l.sellPrice - l.buyPrice - (l.fees || 0)), 0);
  const soldProfit = soldHistory.reduce((s, x) => s + x.profit, 0);
  const daysOnMarket = (listedDate) => Math.floor((Date.now() - new Date(listedDate).getTime()) / 86400000);
  const patrimoine = invTotal + cashTotal + healthTotal + listingsSellTotal;
  const pnlTotal = (invTotal - invInvested) + (healthTotal - healthCost);

  const now = new Date();
  const cm = now.getMonth(), cy = now.getFullYear();
  const monthTx = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === cm && d.getFullYear() === cy; });
  const income = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = Math.abs(monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  const balance = income - expense;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  // Budget progress
  const budgetProgress = {};
  Object.keys(budgets).forEach(cat => {
    const spent = Math.abs(monthTx.filter(t => t.category === cat && t.type === "expense").reduce((s, t) => s + t.amount, 0));
    budgetProgress[cat] = { spent, limit: budgets[cat], pct: budgets[cat] > 0 ? (spent / budgets[cat]) * 100 : 0 };
  });

  // Monthly chart (6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(cy, cm - 5 + i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    const txs = transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === m && td.getFullYear() === y; });
    const inc = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = Math.abs(txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));
    return { month: MONTHS[m], Revenus: inc, Dépenses: exp, Épargne: Math.max(0, inc - exp) };
  });

  // Cat pie
  const catMap = {};
  monthTx.filter(t => t.type === "expense").forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value, color: CAT_COLORS[name] || "#94a3b8" }));

  // Projection
  const projData = Array.from({ length: projYears + 1 }, (_, i) => {
    const r = projRate / 100;
    const future = patrimoine * Math.pow(1 + r, i) + (r > 0 ? projMonthly * 12 * (Math.pow(1 + r, i) - 1) / r : projMonthly * 12 * i);
    return { year: `+${i}a`, Projection: Math.round(future), Base: Math.round(patrimoine + projMonthly * 12 * i) };
  });

  // Score
  const diversif = [...new Set(investments.map(i => i.category))].length;
  const score = healthScore(savingsRate, diversif, 0);

  // Alerts
  const alerts = [];
  Object.entries(budgetProgress).forEach(([cat, { pct, spent, limit }]) => {
    if (pct >= 90) alerts.push({ type: "warning", msg: `Budget ${cat} : ${Math.round(pct)}% utilisé (${fEur(spent)} / ${fEur(limit)})` });
  });

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const saveTx = () => {
    if (!txForm.date || !txForm.label || !txForm.amount) return;
    const amt = parseFloat(txForm.amount);
    const item = { ...txForm, id: editItem?.id || uid(), amount: txForm.type === "expense" ? -Math.abs(amt) : Math.abs(amt) };
    setTransactions(p => editItem ? p.map(t => t.id === editItem.id ? item : t) : [item, ...p]);
    setTxForm(emptyTx); setEditItem(null); setModal(null);
  };
  const delTx = (id) => setTransactions(p => p.filter(t => t.id !== id));
  const editTx = (t) => { setEditItem(t); setTxForm({ ...t, amount: Math.abs(t.amount) }); setModal("tx"); };

  const saveInv = () => {
    if (!invForm.name || !invForm.value || !invForm.invested) return;
    const idx = investments.findIndex(i => i.id === editItem?.id);
    const item = { ...invForm, id: editItem?.id || uid(), value: parseFloat(invForm.value), invested: parseFloat(invForm.invested), color: editItem?.color || INV_COLORS[investments.length % INV_COLORS.length], positions: editItem?.positions || [] };
    setInvestments(p => idx >= 0 ? p.map((x, i) => i === idx ? item : x) : [...p, item]);
    setInvForm(emptyInv); setEditItem(null); setModal(null);
  };
  const delInv = (id) => setInvestments(p => p.filter(i => i.id !== id));
  const editInv = (inv) => { setEditItem(inv); setInvForm({ name: inv.name, category: inv.category, value: inv.value, invested: inv.invested, notes: inv.notes || "" }); setModal("inv"); };

  const saveHealth = () => {
    if (!healthForm.name || !healthForm.currentValue || !healthForm.buyPrice) return;
    const item = { ...healthForm, id: editItem?.id || uid(), buyPrice: parseFloat(healthForm.buyPrice), currentValue: parseFloat(healthForm.currentValue) };
    setHealthAssets(p => editItem ? p.map(h => h.id === editItem.id ? item : h) : [...p, item]);
    setHealthForm(emptyHealth); setEditItem(null); setModal(null);
  };
  const delHealth = (id) => setHealthAssets(p => p.filter(h => h.id !== id));
  const editHealth = (h) => { setEditItem(h); setHealthForm(h); setModal("health"); };

  const savePosition = () => {
    if (!posForm.ticker || !posForm.shares || !posForm.buyPrice) return;
    const livePrc = prices[posForm.ticker];
    const currentPrice = parseFloat(posForm.currentPrice) || livePrc || 0;
    const pos = { ...posForm, id: editItem?.posId || uid(), shares: parseFloat(posForm.shares), buyPrice: parseFloat(posForm.buyPrice), currentPrice };
    setInvestments(p => p.map(inv => {
      if (inv.id !== drillInv?.id) return inv;
      const positions = editItem?.posId ? inv.positions.map(x => x.id === editItem.posId ? pos : x) : [...(inv.positions || []), pos];
      const newValue = positions.reduce((s, x) => s + x.shares * x.currentPrice, 0) || inv.value;
      const newInvested = positions.reduce((s, x) => s + x.shares * x.buyPrice, 0) || inv.invested;
      return { ...inv, positions, value: Math.round(newValue), invested: Math.round(newInvested) };
    }));
    setPosForm(emptyPos); setEditItem(null); setModal("drill");
  };

  const saveListing = () => {
    if (!listingForm.name || listingForm.buyPrice === "" || listingForm.sellPrice === "") return;
    const item = {
      ...listingForm,
      id: editItem?.id || uid(),
      buyPrice: parseFloat(listingForm.buyPrice) || 0,
      sellPrice: parseFloat(listingForm.sellPrice) || 0,
      fees: parseFloat(listingForm.fees) || 0,
    };
    setListings(p => editItem ? p.map(l => l.id === editItem.id ? item : l) : [...p, item]);
    setListingForm(emptyListing); setEditItem(null); setModal(null);
  };
  const delListing = (id) => setListings(p => p.filter(l => l.id !== id));
  const editListing = (l) => { setEditItem(l); setListingForm(l); setModal("listing"); };
  const markSold = (listing) => {
    const profit = listing.sellPrice - listing.buyPrice - (listing.fees || 0);
    setSoldHistory(p => [{ ...listing, profit, soldDate: today() }, ...p]);
    setListings(p => p.filter(l => l.id !== listing.id));
  };

  const saveCash = () => {
    if (!cashForm.name || cashForm.balance === "") return;
    const item = { ...cashForm, id: editItem?.id || uid(), balance: parseFloat(cashForm.balance) || 0, rate: parseFloat(cashForm.rate) || 0 };
    setSavings(p => editItem ? p.map(c => c.id === editItem.id ? item : c) : [...p, item]);
    setCashForm(emptyCash); setEditItem(null); setModal(null);
  };
  const delCash = (id) => setSavings(p => p.filter(c => c.id !== id));
  const editCash = (c) => { setEditItem(c); setCashForm(c); setModal("cash"); };

  const saveGoal = () => {
    if (!goalForm.name || !goalForm.target || !goalForm.deadline) return;
    const item = { ...goalForm, id: editItem?.id || uid(), target: parseFloat(goalForm.target) };
    setGoals(p => editItem ? p.map(g => g.id === editItem.id ? item : g) : [...p, item]);
    setGoalForm(emptyGoal); setEditItem(null); setModal(null);
  };

  // Export CSV
  const exportCSV = () => {
    const rows = [["Date","Libellé","Catégorie","Type","Montant"], ...transactions.map(t => [t.date, t.label, t.category, t.type, t.amount])];
    const csv = rows.map(r => r.join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "transactions.csv"; a.click();
  };

  const TABS = [
    { id: "overview", label: "Vue d'ensemble", icon: "⬡", short: "Vue" },
    { id: "cashflow", label: "Flux", icon: "⇄", short: "Flux" },
    { id: "savings", label: "Épargne & Cash", icon: "🏦", short: "Cash" },
    { id: "market", label: "Achats & Ventes", icon: "🏷️", short: "Ventes" },
    { id: "investments", label: "Investissements", icon: "◈", short: "Invest." },
    { id: "assets", label: "Patrimoine matériel", icon: "◉", short: "Actifs" },
    { id: "budget", label: "Budget & Objectifs", icon: "◎", short: "Budget" },
    { id: "projection", label: "Projection", icon: "⟿", short: "Proj." },
  ];

  // ── Shared form grid ───────────────────────────────────────────────────────
  // useRef garantit une référence stable : React voit toujours le même type de
  // composant et ne démonte/remonte pas les inputs (évite la perte de focus).
  const FRow = useRef(({ cols = 2, children }) => <div className={`frow frow-${cols}`}>{children}</div>).current;
  const FField = useRef(({ label, children }) => <div><Label>{label}</Label>{children}</div>).current;

  return (
    <div style={{ minHeight: "100vh", background: "#080e1a", color: "#f1f5f9", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
        input::placeholder,textarea::placeholder{color:#374151}
        input:focus,select:focus,textarea:focus{border-color:rgba(16,185,129,.5)!important;outline:none}
        input[type=range]{accent-color:#10b981;cursor:pointer;width:100%}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .g6{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
        .g5{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .g3-wide{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
        .g-2-1{display:grid;grid-template-columns:2fr 1fr;gap:16px}
        .g-1-2{display:grid;grid-template-columns:1fr 2fr;gap:16px}
        .g-1-1{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .frow{display:grid;gap:12px;margin-bottom:14px}
        .frow-1{grid-template-columns:1fr}
        .frow-2{grid-template-columns:repeat(2,1fr)}
        .frow-3{grid-template-columns:repeat(3,1fr)}
        .top-nav{display:flex;gap:2px;overflow-x:auto}
        .bot-nav{display:none;position:fixed;bottom:0;left:0;right:0;height:64px;background:#080e1a;border-top:1px solid rgba(255,255,255,.08);z-index:49;align-items:stretch;padding-bottom:env(safe-area-inset-bottom)}
        .page-pad{max-width:1280px;margin:0 auto;padding:28px}
        .hdr-outer{padding:0 28px}
        .modal-overlay{align-items:center}
        .modal-box{border-radius:20px;padding:28px;width:min(600px,95vw);max-height:90vh}
        @media(max-width:767px){
          .g6,.g5,.g4{grid-template-columns:repeat(2,1fr)}
          .g3,.g3-wide,.g-2-1,.g-1-2,.g-1-1{grid-template-columns:1fr}
          .frow-2,.frow-3{grid-template-columns:1fr}
          .top-nav{display:none}
          .bot-nav{display:flex}
          .page-pad{padding:14px 14px 80px}
          .hdr-outer{padding:0 14px}
          .modal-overlay{align-items:flex-end}
          .modal-box{width:100vw;max-width:100vw;border-radius:20px 20px 0 0;padding:20px 16px;max-height:92dvh}
          input,select,textarea{font-size:16px!important}
        }
        @media(min-width:768px) and (max-width:1279px){
          .g6{grid-template-columns:repeat(3,1fr)}
          .g5{grid-template-columns:repeat(3,1fr)}
          .g4{grid-template-columns:repeat(2,1fr)}
          .g3-wide{grid-template-columns:repeat(2,1fr)}
          .g-2-1,.g-1-2{grid-template-columns:1fr}
          .frow-3{grid-template-columns:repeat(2,1fr)}
          .page-pad{padding:20px}
          .hdr-outer{padding:0 20px}
        }
      `}</style>

      {authLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 36, animation: "pulse 1.5s infinite" }}>◈</div>
          <div style={{ fontSize: 14, color: "#4b5563" }}>Chargement…</div>
        </div>
      ) : !user && !demoMode ? (
        <AuthScreen onDemo={() => {
          setTransactions(SEED_TX); setInvestments(SEED_INV); setHealthAssets(SEED_HEALTH);
          setBudgets(SEED_BUDGETS); setGoals(SEED_GOALS); setSavings(SEED_CASH);
          setListings(SEED_LISTINGS); setSoldHistory(SEED_SOLD);
          setDemoMode(true);
        }} />
      ) : (<>

      {/* Header */}
      <div className="hdr-outer" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#080e1a", zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={require('./logo.png')} alt="logo" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.02em" }}>FinLib</span>
            <span style={{ fontSize: 10, background: "rgba(16,185,129,.15)", color: "#10b981", padding: "2px 8px", borderRadius: 20, marginLeft: 4 }}>PRO</span>
          </div>
          <nav className="top-nav">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "rgba(16,185,129,.12)" : "transparent", border: "none", color: tab === t.id ? "#10b981" : "#6b7280", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all .15s" }}>
                <span style={{ fontSize: 10 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {alerts.length > 0 && <div style={{ background: "rgba(251,146,60,.15)", color: "#fb923c", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>⚠ {alerts.length} alerte{alerts.length > 1 ? "s" : ""}</div>}
            {demoMode ? (
              <>
                <span style={{ fontSize: 10, background: "rgba(251,146,60,.15)", color: "#fb923c", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>MODE DÉMO</span>
                <button onClick={() => { setDemoMode(false); setTransactions([]); setInvestments([]); setHealthAssets([]); setBudgets(SEED_BUDGETS); setGoals([]); setSavings([]); setListings([]); setSoldHistory([]); }}
                  style={{ ...btnS, fontSize: 11, padding: "5px 12px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}>
                  Se connecter →
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "#4b5563", textAlign: "right" }}>
                  <div>{new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                  <div style={{ color: "#374151", fontSize: 10 }}>{user?.email}</div>
                </div>
                <button onClick={handleLogout} style={{ ...btnS, fontSize: 11, padding: "5px 12px" }}>⎋ Déco</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="page-pad">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Vue d'ensemble</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Snapshot complet de votre situation financière</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Score santé</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: score >= 70 ? "#4ade80" : score >= 40 ? "#fb923c" : "#f87171" }}>{score}<span style={{ fontSize: 12, fontWeight: 400 }}>/100</span></div>
                </div>
              </div>
            </div>

            {alerts.length > 0 && (
              <div style={{ background: "rgba(251,146,60,.08)", border: "1px solid rgba(251,146,60,.2)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {alerts.map((a, i) => <div key={i} style={{ fontSize: 13, color: "#fb923c" }}>⚠ {a.msg}</div>)}
              </div>
            )}

            <div className="g6">
              <KPI label="Patrimoine total" value={fEur(patrimoine, true)} sub={fPct((pnlTotal / Math.max(1, invInvested + healthCost)) * 100)} icon="🏛️" />
              <KPI label="Actifs financiers" value={fEur(invTotal, true)} icon="📈" accent="#10b981" />
              <KPI label="Épargne & Cash" value={fEur(cashTotal, true)} icon="🏦" accent="#34d399" />
              <KPI label="Patrimoine matériel" value={fEur(healthTotal, true)} icon="🏠" accent="#60a5fa" />
              <KPI label="Revenus du mois" value={fEur(income, true)} icon="💰" />
              <KPI label="Taux d'épargne" value={Math.round(savingsRate) + "%"} sub={fEur(balance) + " épargnés"} accent={balance >= 0 ? "#10b981" : "#f87171"} icon="🎯" />
            </div>

            <div className="g-2-1">
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "#e2e8f0" }}>Revenus vs Dépenses — 6 mois</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Dépenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Dépenses par catégorie</h3>
                {catData.length === 0 ? <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", paddingTop: 50 }}>Aucune dépense ce mois</div> : (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={catData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                          {catData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={v => fEur(v)} contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                      {catData.map((c, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} /><span style={{ color: "#9ca3af" }}>{c.name}</span></div>
                          <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{fEur(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Objectifs */}
            {goals.length > 0 && (
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Objectifs financiers</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
                  {goals.map(g => {
                    const pct = Math.min(100, (patrimoine / g.target) * 100);
                    const monthsLeft = Math.max(0, Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)));
                    return (
                      <div key={g.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 14, borderLeft: `3px solid ${g.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>{monthsLeft} mois</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 6 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: g.color, borderRadius: 4, transition: "width .5s" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280" }}>
                          <span style={{ color: g.color, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                          <span>{fEur(patrimoine, true)} / {fEur(g.target, true)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent TX */}
            <div style={{ ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>Dernières transactions</h3>
                <button onClick={() => setTab("cashflow")} style={{ ...btnS, padding: "4px 10px", fontSize: 11 }}>Voir tout →</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {transactions.slice(0, 6).map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: t.type === "income" ? "rgba(16,185,129,.12)" : "rgba(248,113,113,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{t.type === "income" ? "↓" : "↑"}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label} {t.recurrent && <span style={{ fontSize: 9, background: "rgba(96,165,250,.15)", color: "#60a5fa", padding: "1px 5px", borderRadius: 4 }}>↻</span>}</div>
                        <div style={{ fontSize: 11, color: "#4b5563" }}>{t.category} · {fDate(t.date)}</div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: t.amount > 0 ? "#4ade80" : "#f87171" }}>{t.amount > 0 ? "+" : ""}{fEur(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CASHFLOW ── */}
        {tab === "cashflow" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Flux de trésorerie</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Toutes vos entrées et sorties</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={exportCSV} style={{ ...btnS, fontSize: 12 }}>↓ Export CSV</button>
                <button onClick={() => { setEditItem(null); setTxForm(emptyTx); setModal("tx"); }} style={btnG}>+ Transaction</button>
              </div>
            </div>

            <div className="g4">
              <KPI label="Revenus" value={fEur(income, true)} accent="#4ade80" icon="↓" />
              <KPI label="Dépenses" value={fEur(expense, true)} accent="#f87171" icon="↑" />
              <KPI label="Solde net" value={fEur(balance, true)} accent={balance >= 0 ? "#10b981" : "#f87171"} icon="⚖" />
              <KPI label="Taux d'épargne" value={Math.round(savingsRate) + "%"} accent="#10b981" icon="🎯" />
            </div>

            <div style={{ ...card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Épargne mensuelle</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="epG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} />
                  <Tooltip content={<TT />} />
                  <Area type="monotone" dataKey="Épargne" stroke="#10b981" fill="url(#epG)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>Toutes les transactions ({transactions.length})</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {transactions.map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[t.category] || "#6b7280", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label} {t.recurrent && <span style={{ fontSize: 9, background: "rgba(96,165,250,.15)", color: "#60a5fa", padding: "1px 5px", borderRadius: 4 }}>↻ récurrent</span>}</div>
                        <div style={{ fontSize: 11, color: "#4b5563" }}>{t.category} · {fDate(t.date)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: t.amount > 0 ? "#4ade80" : "#f87171", minWidth: 90, textAlign: "right" }}>{t.amount > 0 ? "+" : ""}{fEur(t.amount)}</span>
                      <button onClick={() => editTx(t)} style={{ ...btnS, padding: "3px 8px", fontSize: 11 }}>✎</button>
                      <button onClick={() => delTx(t.id)} style={{ ...btnD, padding: "3px 8px", fontSize: 11 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ÉPARGNE & CASH ── */}
        {tab === "savings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Épargne & Cash</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Comptes courants, livrets réglementés et liquidités non investies</p>
              </div>
              <button onClick={() => { setEditItem(null); setCashForm(emptyCash); setModal("cash"); }} style={btnG}>+ Compte</button>
            </div>

            <div className="g4">
              <KPI label="Total épargne & cash" value={fEur(cashTotal, true)} icon="🏦" accent="#34d399" />
              <KPI label="Intérêts annuels projetés" value={fEur(annualInterests, true)} icon="💸" accent="#4ade80" />
              <KPI label="Taux moyen pondéré" value={avgRate.toFixed(2) + "%"} icon="%" accent="#60a5fa" />
              <KPI label="Nb de comptes" value={savings.length} icon="🗂️" />
            </div>

            {savings.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: 60, color: "#4b5563" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏦</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Aucun compte</div>
                <div style={{ fontSize: 13 }}>Ajoutez votre compte courant, Livret A, LDD…</div>
              </div>
            ) : (
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Détail des comptes</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {savings.map(c => {
                    const interests = c.balance * (c.rate / 100);
                    const color = CASH_TYPE_COLORS[c.type] || "#94a3b8";
                    return (
                      <div key={c.id} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, borderLeft: `3px solid ${color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                              <span style={{ fontSize: 10, background: `${color}22`, color, padding: "2px 7px", borderRadius: 20, fontWeight: 500 }}>{c.type}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#4b5563" }}>
                              Taux : {c.rate > 0 ? c.rate.toFixed(2) + "% / an" : "Non rémunéré"}
                              {c.rate > 0 && <span style={{ color: "#4ade80", marginLeft: 10 }}>→ {fEur(interests)} / an</span>}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{fEur(c.balance)}</div>
                              <div style={{ fontSize: 11, color: "#4b5563" }}>{((c.balance / cashTotal) * 100).toFixed(1)}% du total</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              <button onClick={() => editCash(c)} style={{ ...btnS, padding: "3px 10px", fontSize: 11 }}>✎</button>
                              <button onClick={() => delCash(c.id)} style={{ ...btnD, padding: "3px 10px", fontSize: 11 }}>✕</button>
                            </div>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 3, marginTop: 12 }}>
                          <div style={{ width: `${(c.balance / cashTotal) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#6b7280" }}>Total</span>
                  <span style={{ fontWeight: 700, color: "#34d399" }}>{fEur(cashTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACHATS & VENTES ── */}
        {tab === "market" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Achats & Ventes</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Articles en cours de vente — crypto, actions, objets physiques</p>
              </div>
              <button onClick={() => { setEditItem(null); setListingForm(emptyListing); setModal("listing"); }} style={btnG}>+ Article</button>
            </div>

            {/* KPIs */}
            <div className="g4">
              <KPI label="Investi en articles" value={fEur(listingsBuyTotal, true)} icon="💸" />
              <KPI label="Valeur de vente totale" value={fEur(listingsSellTotal, true)} icon="🏷️" accent="#60a5fa" />
              <KPI label="Bénéfice espéré" value={fEur(listingsExpectedProfit, true)} accent={listingsExpectedProfit >= 0 ? "#4ade80" : "#f87171"} icon="📊" />
              <KPI label="Bénéfice réalisé" value={fEur(soldProfit, true)} accent={soldProfit >= 0 ? "#10b981" : "#f87171"} icon="✅" />
            </div>

            {/* Articles en vente */}
            <div style={{ ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>En vente ({listings.length})</h3>
                {listings.length > 0 && <span style={{ fontSize: 11, color: "#4b5563" }}>Bénéfice espéré total : <span style={{ color: listingsExpectedProfit >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{fEur(listingsExpectedProfit)}</span></span>}
              </div>
              {listings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#4b5563" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🏷️</div>
                  <div style={{ fontSize: 13 }}>Aucun article en vente — cliquez sur + Article pour commencer</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {listings.map(l => {
                    const profit = l.sellPrice - l.buyPrice - (l.fees || 0);
                    const days = daysOnMarket(l.listedDate);
                    const catColor = LISTING_CAT_COLORS[l.category] || "#94a3b8";
                    const platIcon = LISTING_PLATFORM_ICONS[l.platform] || "🏷️";
                    return (
                      <div key={l.id} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, borderLeft: `3px solid ${catColor}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          {/* Infos principales */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 5 }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</span>
                              <span style={{ fontSize: 10, background: `${catColor}22`, color: catColor, padding: "2px 7px", borderRadius: 20, fontWeight: 500 }}>{l.category}</span>
                              <span style={{ fontSize: 11, color: "#6b7280" }}>{platIcon} {l.platform}</span>
                              <span style={{ fontSize: 10, background: days > 30 ? "rgba(248,113,113,.15)" : "rgba(255,255,255,.06)", color: days > 30 ? "#f87171" : "#6b7280", padding: "2px 7px", borderRadius: 20 }}>
                                {days === 0 ? "Aujourd'hui" : `${days}j en vente`}
                              </span>
                            </div>
                            {l.notes && <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 4 }}>📝 {l.notes}</div>}
                            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                              <span>Acheté : <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{fEur(l.buyPrice)}</span></span>
                              <span>Vente : <span style={{ color: "#60a5fa", fontWeight: 500 }}>{fEur(l.sellPrice)}</span></span>
                              {l.fees > 0 && <span>Frais : <span style={{ color: "#f87171" }}>−{fEur(l.fees)}</span></span>}
                            </div>
                          </div>
                          {/* Bénéfice + actions */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: profit >= 0 ? "#4ade80" : "#f87171" }}>{profit >= 0 ? "+" : ""}{fEur(profit)}</div>
                              <div style={{ fontSize: 10, color: "#4b5563" }}>bénéfice espéré</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <button onClick={() => editListing(l)} style={{ ...btnS, padding: "3px 8px", fontSize: 10 }}>✎</button>
                              <button onClick={() => delListing(l.id)} style={{ ...btnD, padding: "3px 8px", fontSize: 10 }}>✕</button>
                              <button onClick={() => markSold(l)} title="Marquer comme vendu" style={{ ...btnG, padding: "3px 8px", fontSize: 10, background: "linear-gradient(135deg,#10b981,#059669)" }}>✓</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historique des ventes */}
            <div style={{ ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>Historique des ventes ({soldHistory.length})</h3>
                {soldHistory.length > 0 && (
                  <span style={{ fontSize: 11 }}>
                    Total réalisé : <span style={{ color: soldProfit >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{soldProfit >= 0 ? "+" : ""}{fEur(soldProfit)}</span>
                  </span>
                )}
              </div>
              {soldHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#4b5563", fontSize: 13 }}>Aucune vente réalisée pour l'instant</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {soldHistory.map(x => {
                    const catColor = LISTING_CAT_COLORS[x.category] || "#94a3b8";
                    const platIcon = LISTING_PLATFORM_ICONS[x.platform] || "🏷️";
                    return (
                      <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, borderLeft: `2px solid ${catColor}` }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{x.name}</span>
                            <span style={{ fontSize: 10, background: `${catColor}22`, color: catColor, padding: "1px 6px", borderRadius: 20 }}>{x.category}</span>
                            <span style={{ fontSize: 11, color: "#4b5563" }}>{platIcon} {x.platform}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>
                            Vendu le {fDate(x.soldDate)} · Achat {fEur(x.buyPrice)} · Vente {fEur(x.sellPrice)}{x.fees > 0 ? ` · Frais ${fEur(x.fees)}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: x.profit >= 0 ? "#4ade80" : "#f87171" }}>{x.profit >= 0 ? "+" : ""}{fEur(x.profit)}</span>
                          <button onClick={() => setSoldHistory(p => p.filter(s => s.id !== x.id))} style={{ ...btnD, padding: "2px 7px", fontSize: 10 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INVESTMENTS ── */}
        {tab === "investments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Investissements</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Cliquez sur un actif pour voir le détail des positions</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {priceStatus === "loading" && <span style={{ fontSize: 11, color: "#60a5fa" }}>⟳ Actualisation…</span>}
                {priceStatus === "ok" && lastUpdated && (
                  <span style={{ fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }} />
                    LIVE · {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
                {priceStatus === "error" && <span style={{ fontSize: 11, color: "#f87171" }}>⚠ Serveur prix déconnecté</span>}
                <button onClick={fetchPrices} title="Actualiser les prix" style={{ ...btnS, fontSize: 13, padding: "3px 10px" }}>⟳</button>
                <button onClick={() => { setEditItem(null); setInvForm(emptyInv); setModal("inv"); }} style={btnG}>+ Actif</button>
              </div>
            </div>

            <div className="g4">
              <KPI label="Patrimoine financier" value={fEur(invTotal, true)} icon="🏛️" />
              <KPI label="Capital investi" value={fEur(invInvested, true)} icon="💸" />
              <KPI label="Plus-values" value={fEur(invTotal - invInvested, true)} accent={(invTotal - invInvested) >= 0 ? "#4ade80" : "#f87171"} icon="📊" />
              <KPI label="Performance" value={fPct(invInvested > 0 ? ((invTotal - invInvested) / invInvested) * 100 : 0)} accent={invTotal >= invInvested ? "#10b981" : "#f87171"} icon="⚡" />
            </div>

            <div className="g-1-2">
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Allocation</h3>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={investments.map(inv => ({ ...inv, value: invLiveValue(inv) }))} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={4} dataKey="value">
                      {investments.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fEur(v)} contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                  {investments.map((inv, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 7, height: 7, borderRadius: 2, background: inv.color }} /><span style={{ color: "#9ca3af" }}>{inv.category}</span></div>
                      <span>{((inv.value / invTotal) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Détail des actifs</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {investments.map(inv => {
                    const lv = invLiveValue(inv);
                    const pnl = lv - inv.invested;
                    const pct = inv.invested > 0 ? (pnl / inv.invested) * 100 : 0;
                    return (
                      <div key={inv.id} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 12, borderLeft: `3px solid ${inv.color}`, cursor: "pointer", transition: "background .15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onClick={() => { setDrillInv(inv); setModal("drill"); }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.name} <span style={{ fontSize: 10, color: "#6b7280" }}>↗ détails</span></div>
                            <div style={{ fontSize: 11, color: "#4b5563" }}>{inv.category} · {inv.positions?.length || 0} position{(inv.positions?.length || 0) > 1 ? "s" : ""}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{fEur(lv)}</div>
                            <div style={{ fontSize: 11, color: pnl >= 0 ? "#4ade80" : "#f87171" }}>{pnl >= 0 ? "+" : ""}{fEur(pnl)} ({fPct(pct)})</div>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 3 }}>
                          <div style={{ width: `${(lv / invTotal) * 100}%`, height: "100%", background: inv.color, borderRadius: 4 }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); editInv(inv); }} style={{ ...btnS, padding: "2px 8px", fontSize: 10 }}>✎ Modifier</button>
                            <button onClick={e => { e.stopPropagation(); delInv(inv.id); }} style={{ ...btnD, padding: "2px 8px", fontSize: 10 }}>✕</button>
                          </div>
                          <span style={{ fontSize: 10, color: "#4b5563" }}>{((lv / invTotal) * 100).toFixed(1)}% du portefeuille</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ASSETS PHYSIQUES ── */}
        {tab === "assets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Patrimoine matériel</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Voiture, collections, mobilier, électronique…</p>
              </div>
              <button onClick={() => { setEditItem(null); setHealthForm(emptyHealth); setModal("health"); }} style={btnG}>+ Objet</button>
            </div>

            <div className="g4">
              <KPI label="Valeur actuelle" value={fEur(healthTotal, true)} icon="🏠" accent="#60a5fa" />
              <KPI label="Coût d'acquisition" value={fEur(healthCost, true)} icon="💳" />
              <KPI label="Plus/Moins-value" value={fEur(healthTotal - healthCost, true)} accent={(healthTotal - healthCost) >= 0 ? "#4ade80" : "#f87171"} icon="📊" />
              <KPI label="Nb d'actifs" value={healthAssets.length} icon="📦" />
            </div>

            {/* Répartition par cat */}
            {healthAssets.length > 0 && (() => {
              const catTotals = {};
              healthAssets.forEach(h => { catTotals[h.category] = (catTotals[h.category] || 0) + h.currentValue; });
              const pieData = Object.entries(catTotals).map(([name, value], i) => ({ name, value, color: INV_COLORS[i % INV_COLORS.length] }));
              return (
                <div className="g-1-2">
                  <div style={{ ...card }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Répartition</h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={v => fEur(v)} contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                      {pieData.map((c, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} /><span style={{ color: "#9ca3af" }}>{c.name}</span></div>
                          <span>{fEur(c.value, true)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...card }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Détail des actifs matériels</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {healthAssets.map(h => {
                        const pnl = h.currentValue - h.buyPrice;
                        const pct = h.buyPrice > 0 ? (pnl / h.buyPrice) * 100 : 0;
                        return (
                          <div key={h.id} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.name}</div>
                                <div style={{ fontSize: 11, color: "#4b5563" }}>{h.category}{h.notes ? ` · ${h.notes}` : ""} · acquis le {fDate(h.date)}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{fEur(h.currentValue)}</div>
                                <div style={{ fontSize: 11, color: pnl >= 0 ? "#4ade80" : "#f87171" }}>{pnl >= 0 ? "+" : ""}{fEur(pnl)} ({fPct(pct)})</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Prix d'achat : {fEur(h.buyPrice)}</div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => editHealth(h)} style={{ ...btnS, padding: "3px 10px", fontSize: 11 }}>✎ Modifier</button>
                              <button onClick={() => delHealth(h.id)} style={{ ...btnD, padding: "3px 10px", fontSize: 11 }}>✕ Supprimer</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {healthAssets.length === 0 && (
              <div style={{ ...card, textAlign: "center", padding: 60, color: "#4b5563" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Aucun actif matériel</div>
                <div style={{ fontSize: 13 }}>Ajoutez votre voiture, collections, mobilier…</div>
              </div>
            )}
          </div>
        )}

        {/* ── BUDGET & OBJECTIFS ── */}
        {tab === "budget" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Budget & Objectifs</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Plafonds mensuels et buts financiers</p>
              </div>
              <button onClick={() => { setEditItem(null); setGoalForm(emptyGoal); setModal("goal"); }} style={btnG}>+ Objectif</button>
            </div>

            <div className="g-1-1">
              {/* Budgets */}
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Budgets mensuels</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.entries(budgets).map(([cat, limit]) => {
                    const { spent, pct } = budgetProgress[cat] || { spent: 0, pct: 0 };
                    const color = pct >= 100 ? "#f87171" : pct >= 80 ? "#fb923c" : "#10b981";
                    return (
                      <div key={cat}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat] || "#6b7280" }} />
                            <span style={{ fontWeight: 500 }}>{cat}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "#6b7280", fontSize: 12 }}>{fEur(spent)} / </span>
                            <input type="number" value={limit} onChange={e => setBudgets(p => ({ ...p, [cat]: +e.target.value }))}
                              style={{ ...inp, width: 80, padding: "3px 8px", fontSize: 12, textAlign: "right" }} />
                            <span style={{ fontSize: 12, color: "#6b7280" }}>€</span>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
                        </div>
                        <div style={{ fontSize: 10, color, marginTop: 3, textAlign: "right" }}>{Math.round(pct)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Objectifs */}
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Objectifs financiers</h3>
                {goals.length === 0 && <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", paddingTop: 40 }}>Aucun objectif défini</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {goals.map(g => {
                    const pct = Math.min(100, (patrimoine / g.target) * 100);
                    const monthsLeft = Math.max(0, Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)));
                    const needed = g.target - patrimoine;
                    const perMonth = monthsLeft > 0 ? needed / monthsLeft : 0;
                    return (
                      <div key={g.id} style={{ padding: "14px", background: "rgba(255,255,255,0.03)", borderRadius: 12, borderLeft: `3px solid ${g.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setEditItem(g); setGoalForm(g); setModal("goal"); }} style={{ ...btnS, padding: "2px 7px", fontSize: 10 }}>✎</button>
                            <button onClick={() => setGoals(p => p.filter(x => x.id !== g.id))} style={{ ...btnD, padding: "2px 7px", fontSize: 10 }}>✕</button>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: g.color, borderRadius: 4, transition: "width .5s" }} />
                        </div>
                        <div className="g-1-1" style={{ gap: 6, fontSize: 11 }}>
                          <div><span style={{ color: "#6b7280" }}>Atteint : </span><span style={{ color: g.color, fontWeight: 600 }}>{pct.toFixed(0)}% — {fEur(patrimoine, true)}</span></div>
                          <div><span style={{ color: "#6b7280" }}>Objectif : </span><span style={{ fontWeight: 600 }}>{fEur(g.target, true)}</span></div>
                          <div><span style={{ color: "#6b7280" }}>Échéance : </span><span>{fDate(g.deadline)} ({monthsLeft} mois)</span></div>
                          {perMonth > 0 && <div><span style={{ color: "#6b7280" }}>Effort / mois : </span><span style={{ color: "#fb923c", fontWeight: 600 }}>{fEur(perMonth, true)}</span></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTION ── */}
        {tab === "projection" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Projection & Intérêts composés</h1>
              <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Simulez la croissance de votre patrimoine total ({fEur(patrimoine, true)} de départ)</p>
            </div>

            <div style={{ ...card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18 }}>Paramètres</h3>
              <div className="g3-wide">
                {[
                  { label: "Durée", val: projYears, set: setProjYears, min: 1, max: 40, unit: " ans", step: 1 },
                  { label: "Rendement annuel", val: projRate, set: setProjRate, min: 1, max: 20, unit: "%", step: 0.5 },
                  { label: "Versement mensuel", val: projMonthly, set: setProjMonthly, min: 0, max: 5000, unit: " €/mois", step: 50 },
                ].map(({ label, val, set, min, max, unit, step }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{typeof val === "number" && !Number.isInteger(val) ? val.toFixed(1) : val}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(+e.target.value)} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginTop: 2 }}>
                      <span>{min}{unit.includes("%") ? "%" : ""}</span><span>{max}{unit.includes("%") ? "%" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(() => {
              const fin = projData[projData.length - 1];
              const interets = fin.Projection - fin.Base;
              return (
                <div className="g4">
                  <KPI label="Capital de départ" value={fEur(patrimoine, true)} icon="💰" />
                  <KPI label={`Dans ${projYears} ans`} value={fEur(fin.Projection, true)} accent="#10b981" icon="🚀" />
                  <KPI label="Versements totaux" value={fEur(projMonthly * 12 * projYears, true)} icon="📅" />
                  <KPI label="Intérêts générés" value={fEur(interets, true)} accent="#4ade80" icon="✨" />
                </div>
              );
            })()}

            <div style={{ ...card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Évolution du patrimoine</h3>
              <p style={{ fontSize: 11, color: "#4b5563", marginBottom: 16 }}>Avec intérêts composés à {projRate}%/an vs sans rendement</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={projData}>
                  <defs>
                    <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1} /><stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} />
                  <Tooltip content={<TT />} />
                  <Area type="monotone" dataKey="Base" name="Sans rendement" stroke="#60a5fa" fill="url(#bG)" strokeWidth={1.5} strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="Projection" name="Avec rendement" stroke="#10b981" fill="url(#pG)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Jalons clés</h3>
              <div className="g5">
                {[1, 2, 5, 10, 20, 30].filter(y => y <= projYears && projData[y]).map(y => {
                  const d = projData[y];
                  return (
                    <div key={y} style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 12, textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Dans {y} an{y > 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{fEur(d.Projection, true)}</div>
                      <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>×{(d.Projection / patrimoine).toFixed(1)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {/* Transaction */}
      {modal === "tx" && (
        <Modal title={editItem ? "Modifier la transaction" : "Nouvelle transaction"} onClose={() => { setModal(null); setEditItem(null); setTxForm(emptyTx); }}>
          <FRow cols={2}>
            <FField label="Date"><input type="date" style={inp} value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} /></FField>
            <FField label="Type">
              <select style={inp} value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))}>
                <option value="income">Entrée (revenu)</option>
                <option value="expense">Sortie (dépense)</option>
              </select>
            </FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Libellé"><input type="text" placeholder="Ex : Salaire, Loyer…" style={inp} value={txForm.label} onChange={e => setTxForm(p => ({ ...p, label: e.target.value }))} /></FField>
            <FField label="Montant (€)"><input type="number" placeholder="0" style={inp} value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} /></FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Catégorie">
              <select style={inp} value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))}>
                {Object.keys(CAT_COLORS).map(c => <option key={c}>{c}</option>)}
              </select>
            </FField>
            <FField label="Récurrente ?">
              <select style={inp} value={txForm.recurrent ? "oui" : "non"} onChange={e => setTxForm(p => ({ ...p, recurrent: e.target.value === "oui" }))}>
                <option value="non">Non (ponctuelle)</option>
                <option value="oui">Oui (mensuelle)</option>
              </select>
            </FField>
          </FRow>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={saveTx} style={btnG}>{editItem ? "Enregistrer" : "Ajouter"}</button>
            <button onClick={() => { setModal(null); setEditItem(null); setTxForm(emptyTx); }} style={btnS}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Investissement */}
      {modal === "inv" && (
        <Modal title={editItem ? "Modifier l'actif" : "Nouvel actif financier"} onClose={() => { setModal(null); setEditItem(null); setInvForm(emptyInv); }}>
          <FRow cols={2}>
            <FField label="Nom"><input type="text" placeholder="Ex : PEA — ETF World" style={inp} value={invForm.name} onChange={e => setInvForm(p => ({ ...p, name: e.target.value }))} /></FField>
            <FField label="Catégorie">
              <select style={inp} value={invForm.category} onChange={e => setInvForm(p => ({ ...p, category: e.target.value }))}>
                {INV_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Valeur actuelle (€)"><input type="number" placeholder="0" style={inp} value={invForm.value} onChange={e => setInvForm(p => ({ ...p, value: e.target.value }))} /></FField>
            <FField label="Montant investi (€)"><input type="number" placeholder="0" style={inp} value={invForm.invested} onChange={e => setInvForm(p => ({ ...p, invested: e.target.value }))} /></FField>
          </FRow>
          <FRow cols={1}>
            <FField label="Notes (optionnel)"><input type="text" placeholder="Remarques…" style={inp} value={invForm.notes} onChange={e => setInvForm(p => ({ ...p, notes: e.target.value }))} /></FField>
          </FRow>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={saveInv} style={btnG}>{editItem ? "Enregistrer" : "Ajouter"}</button>
            <button onClick={() => { setModal(null); setEditItem(null); setInvForm(emptyInv); }} style={btnS}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Actif physique */}
      {modal === "health" && (
        <Modal title={editItem ? "Modifier l'actif" : "Nouvel actif matériel"} onClose={() => { setModal(null); setEditItem(null); setHealthForm(emptyHealth); }}>
          <FRow cols={2}>
            <FField label="Nom"><input type="text" placeholder="Ex : Renault Clio, Collection Pop…" style={inp} value={healthForm.name} onChange={e => setHealthForm(p => ({ ...p, name: e.target.value }))} /></FField>
            <FField label="Catégorie">
              <select style={inp} value={healthForm.category} onChange={e => setHealthForm(p => ({ ...p, category: e.target.value }))}>
                {HEALTH_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Prix d'achat (€)"><input type="number" placeholder="0" style={inp} value={healthForm.buyPrice} onChange={e => setHealthForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
            <FField label="Valeur actuelle (€)"><input type="number" placeholder="0" style={inp} value={healthForm.currentValue} onChange={e => setHealthForm(p => ({ ...p, currentValue: e.target.value }))} /></FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Date d'acquisition"><input type="date" style={inp} value={healthForm.date} onChange={e => setHealthForm(p => ({ ...p, date: e.target.value }))} /></FField>
            <FField label="Notes"><input type="text" placeholder="Remarques…" style={inp} value={healthForm.notes} onChange={e => setHealthForm(p => ({ ...p, notes: e.target.value }))} /></FField>
          </FRow>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={saveHealth} style={btnG}>{editItem ? "Enregistrer" : "Ajouter"}</button>
            <button onClick={() => { setModal(null); setEditItem(null); setHealthForm(emptyHealth); }} style={btnS}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Objectif */}
      {modal === "goal" && (
        <Modal title={editItem ? "Modifier l'objectif" : "Nouvel objectif"} onClose={() => { setModal(null); setEditItem(null); setGoalForm(emptyGoal); }}>
          <FRow cols={1}>
            <FField label="Nom de l'objectif"><input type="text" placeholder="Ex : Indépendance financière" style={inp} value={goalForm.name} onChange={e => setGoalForm(p => ({ ...p, name: e.target.value }))} /></FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Montant cible (€)"><input type="number" placeholder="0" style={inp} value={goalForm.target} onChange={e => setGoalForm(p => ({ ...p, target: e.target.value }))} /></FField>
            <FField label="Date limite"><input type="date" style={inp} value={goalForm.deadline} onChange={e => setGoalForm(p => ({ ...p, deadline: e.target.value }))} /></FField>
          </FRow>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={saveGoal} style={btnG}>{editItem ? "Enregistrer" : "Ajouter"}</button>
            <button onClick={() => { setModal(null); setEditItem(null); setGoalForm(emptyGoal); }} style={btnS}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Épargne & Cash */}
      {modal === "cash" && (
        <Modal title={editItem ? "Modifier le compte" : "Nouveau compte"} onClose={() => { setModal(null); setEditItem(null); setCashForm(emptyCash); }}>
          <FRow cols={2}>
            <FField label="Nom du compte">
              <input type="text" placeholder="Ex : Livret A Crédit Agricole" style={inp} value={cashForm.name} onChange={e => setCashForm(p => ({ ...p, name: e.target.value }))} />
            </FField>
            <FField label="Type">
              <select style={inp} value={cashForm.type} onChange={e => setCashForm(p => ({ ...p, type: e.target.value }))}>
                {CASH_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Solde actuel (€)">
              <input type="number" placeholder="0" style={inp} value={cashForm.balance} onChange={e => setCashForm(p => ({ ...p, balance: e.target.value }))} />
            </FField>
            <FField label="Taux d'intérêt annuel (%)">
              <input type="number" placeholder="0" step="0.01" style={inp} value={cashForm.rate} onChange={e => setCashForm(p => ({ ...p, rate: e.target.value }))} />
            </FField>
          </FRow>
          {cashForm.balance && cashForm.rate > 0 && (
            <div style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#4ade80" }}>
              💰 Intérêts annuels estimés : {fEur(parseFloat(cashForm.balance) * parseFloat(cashForm.rate) / 100)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={saveCash} style={btnG}>{editItem ? "Enregistrer" : "Ajouter"}</button>
            <button onClick={() => { setModal(null); setEditItem(null); setCashForm(emptyCash); }} style={btnS}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Article en vente */}
      {modal === "listing" && (
        <Modal title={editItem ? "Modifier l'article" : "Nouvel article en vente"} onClose={() => { setModal(null); setEditItem(null); setListingForm(emptyListing); }}>
          <FRow cols={2}>
            <FField label="Nom de l'article">
              <input type="text" placeholder="Ex : iPhone 13 Pro, 0.1 BTC…" style={inp} value={listingForm.name} onChange={e => setListingForm(p => ({ ...p, name: e.target.value }))} />
            </FField>
            <FField label="Catégorie">
              <select style={inp} value={listingForm.category} onChange={e => setListingForm(p => ({ ...p, category: e.target.value }))}>
                {LISTING_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </FField>
          </FRow>
          <FRow cols={2}>
            <FField label="Plateforme">
              <select style={inp} value={listingForm.platform} onChange={e => setListingForm(p => ({ ...p, platform: e.target.value }))}>
                {LISTING_PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
              </select>
            </FField>
            <FField label="Date de mise en vente">
              <input type="date" style={inp} value={listingForm.listedDate} onChange={e => setListingForm(p => ({ ...p, listedDate: e.target.value }))} />
            </FField>
          </FRow>
          <FRow cols={3}>
            <FField label="Prix d'achat (€)">
              <input type="number" placeholder="0" style={inp} value={listingForm.buyPrice} onChange={e => setListingForm(p => ({ ...p, buyPrice: e.target.value }))} />
            </FField>
            <FField label="Prix de vente souhaité (€)">
              <input type="number" placeholder="0" style={inp} value={listingForm.sellPrice} onChange={e => setListingForm(p => ({ ...p, sellPrice: e.target.value }))} />
            </FField>
            <FField label="Frais (expéd. / commission)">
              <input type="number" placeholder="0" style={inp} value={listingForm.fees} onChange={e => setListingForm(p => ({ ...p, fees: e.target.value }))} />
            </FField>
          </FRow>
          {listingForm.buyPrice !== "" && listingForm.sellPrice !== "" && (() => {
            const profit = parseFloat(listingForm.sellPrice || 0) - parseFloat(listingForm.buyPrice || 0) - parseFloat(listingForm.fees || 0);
            return (
              <div style={{ background: profit >= 0 ? "rgba(16,185,129,.08)" : "rgba(248,113,113,.08)", border: `1px solid ${profit >= 0 ? "rgba(16,185,129,.2)" : "rgba(248,113,113,.2)"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: profit >= 0 ? "#4ade80" : "#f87171" }}>
                {profit >= 0 ? "💰" : "⚠️"} Bénéfice espéré : <strong>{profit >= 0 ? "+" : ""}{fEur(profit)}</strong>
                {profit < 0 && <span style={{ color: "#6b7280", marginLeft: 8 }}>Vous vendez à perte.</span>}
              </div>
            );
          })()}
          <FRow cols={1}>
            <FField label="Note (optionnelle)">
              <input type="text" placeholder="État, description…" style={inp} value={listingForm.notes} onChange={e => setListingForm(p => ({ ...p, notes: e.target.value }))} />
            </FField>
          </FRow>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={saveListing} style={btnG}>{editItem ? "Enregistrer" : "Ajouter l'article"}</button>
            <button onClick={() => { setModal(null); setEditItem(null); setListingForm(emptyListing); }} style={btnS}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* Mobile bottom nav */}
      <nav className="bot-nav">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, border: "none", background: "none", color: tab === t.id ? "#10b981" : "#4b5563", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", fontFamily: "inherit", padding: "4px 2px" }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: tab === t.id ? 600 : 400, whiteSpace: "nowrap" }}>{t.short}</span>
          </button>
        ))}
      </nav>

      {/* Drill-down investissement */}
      {modal === "drill" && drillInv && (
        <Modal title={`${drillInv.name} — Positions`} onClose={() => { setModal(null); setPosForm(emptyPos); setEditItem(null); }}>
          <div className="g3" style={{ marginBottom: 16 }}>
            {(() => {
              const cur = investments.find(i => i.id === drillInv.id) || { value: 0, invested: 0, positions: [] };
              const lv = invLiveValue(cur);
              return [{ l: "Valeur", v: fEur(lv) }, { l: "Investi", v: fEur(cur.invested) }, { l: "P&L", v: fEur(lv - cur.invested) }];
            })().map(x => (
              <div key={x.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{x.l}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Positions existantes */}
          {(investments.find(i => i.id === drillInv.id)?.positions || []).map(pos => {
            const pnl = (pos.currentPrice - pos.buyPrice) * pos.shares;
            const pct = pos.buyPrice > 0 ? ((pos.currentPrice - pos.buyPrice) / pos.buyPrice) * 100 : 0;
            return (
              <div key={pos.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{pos.ticker}</span>
                    <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 8 }}>{pos.name}</span>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>
                      {pos.shares} unités · PA {fEur(pos.buyPrice)} · Actuel {fPrice(prices[pos.ticker] ?? pos.currentPrice)}
                      {prices[pos.ticker] !== undefined && <span style={{ marginLeft: 5, fontSize: 9, background: "rgba(16,185,129,.2)", color: "#10b981", padding: "1px 5px", borderRadius: 3 }}>LIVE</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{fEur(pos.shares * pos.currentPrice)}</div>
                    <div style={{ fontSize: 11, color: pnl >= 0 ? "#4ade80" : "#f87171" }}>{pnl >= 0 ? "+" : ""}{fEur(pnl)} ({fPct(pct)})</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => { setEditItem({ posId: pos.id }); setPosForm({ ticker: pos.ticker, name: pos.name, shares: pos.shares, buyPrice: pos.buyPrice, currentPrice: pos.currentPrice }); }} style={{ ...btnS, padding: "2px 8px", fontSize: 10 }}>✎</button>
                  <button onClick={() => {
                    setInvestments(p => p.map(inv => inv.id !== drillInv.id ? inv : { ...inv, positions: inv.positions.filter(x => x.id !== pos.id) }));
                    setDrillInv(prev => ({ ...prev, positions: prev.positions.filter(x => x.id !== pos.id) }));
                  }} style={{ ...btnD, padding: "2px 8px", fontSize: 10 }}>✕</button>
                </div>
              </div>
            );
          })}

          {/* Ajouter/modifier position */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, marginTop: 8 }}>
            <h4 style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>{editItem?.posId ? "Modifier la position" : "Ajouter une position"}</h4>
            <FRow cols={2}>
              <FField label="Ticker (quittez le champ pour auto-fetch)">
                <input type="text" placeholder="Ex: CW8, BTC, AAPL" style={inp} value={posForm.ticker}
                  onChange={e => setPosForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                  onBlur={e => fetchTickerPrice(e.target.value.toUpperCase())} />
              </FField>
              <FField label="Nom"><input type="text" placeholder="Nom complet" style={inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} /></FField>
            </FRow>
            <FRow cols={3}>
              <FField label="Quantité"><input type="number" placeholder="0" style={inp} value={posForm.shares} onChange={e => setPosForm(p => ({ ...p, shares: e.target.value }))} /></FField>
              <FField label="Prix d'achat (€)"><input type="number" placeholder="0" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
              <FField label={fetchingPrice ? "Prix actuel — récupération…" : prices[posForm.ticker] != null ? "Prix actuel (€) ● EN DIRECT" : "Prix actuel (€)"}>
                <input type="number" placeholder={fetchingPrice ? "Chargement…" : "Auto si ticker reconnu"}
                  style={{ ...inp, opacity: fetchingPrice ? 0.6 : 1 }} value={posForm.currentPrice}
                  onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} />
              </FField>
            </FRow>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={savePosition} style={btnG}>{editItem?.posId ? "Modifier" : "Ajouter la position"}</button>
              {editItem?.posId && <button onClick={() => { setEditItem(null); setPosForm(emptyPos); }} style={btnS}>Annuler</button>}
            </div>
          </div>
        </Modal>
      )}
      </>)}
    </div>
  );
}
