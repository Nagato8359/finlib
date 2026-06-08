import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fEur = (n, compact = false) => {
  if (compact && Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(".", ",") + "k €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
};
const fPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
const fDate = (d) => new Date(d).toLocaleDateString("fr-FR");
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

// ── Persist ───────────────────────────────────────────────────────────────────
const load = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

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
  { id: uid(), name: "Livret A", category: "Épargne liquide", value: 7500, invested: 7500, color: "#34d399", positions: [] },
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
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 28, width: "min(600px,95vw)", maxHeight: "90vh", overflowY: "auto" }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("overview");

  // State persisted
  const [transactions, setTransactions] = useState(() => load("fl_tx", SEED_TX));
  const [investments, setInvestments] = useState(() => load("fl_inv", SEED_INV));
  const [healthAssets, setHealthAssets] = useState(() => load("fl_health", SEED_HEALTH));
  const [budgets, setBudgets] = useState(() => load("fl_budgets", SEED_BUDGETS));
  const [goals, setGoals] = useState(() => load("fl_goals", SEED_GOALS));
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
  const [txForm, setTxForm] = useState(emptyTx);
  const [invForm, setInvForm] = useState(emptyInv);
  const [healthForm, setHealthForm] = useState(emptyHealth);
  const [posForm, setPosForm] = useState(emptyPos);
  const [goalForm, setGoalForm] = useState(emptyGoal);

  // Persist on change
  useEffect(() => save("fl_tx", transactions), [transactions]);
  useEffect(() => save("fl_inv", investments), [investments]);
  useEffect(() => save("fl_health", healthAssets), [healthAssets]);
  useEffect(() => save("fl_budgets", budgets), [budgets]);
  useEffect(() => save("fl_goals", goals), [goals]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const invTotal = investments.reduce((s, i) => s + i.value, 0);
  const invInvested = investments.reduce((s, i) => s + i.invested, 0);
  const healthTotal = healthAssets.reduce((s, h) => s + h.currentValue, 0);
  const healthCost = healthAssets.reduce((s, h) => s + h.buyPrice, 0);
  const patrimoine = invTotal + healthTotal;
  const pnlTotal = patrimoine - invInvested - healthCost;

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
    if (!posForm.ticker || !posForm.shares || !posForm.buyPrice || !posForm.currentPrice) return;
    const pos = { ...posForm, id: editItem?.posId || uid(), shares: parseFloat(posForm.shares), buyPrice: parseFloat(posForm.buyPrice), currentPrice: parseFloat(posForm.currentPrice) };
    setInvestments(p => p.map(inv => {
      if (inv.id !== drillInv?.id) return inv;
      const positions = editItem?.posId ? inv.positions.map(x => x.id === editItem.posId ? pos : x) : [...(inv.positions || []), pos];
      const newValue = positions.reduce((s, x) => s + x.shares * x.currentPrice, 0) || inv.value;
      const newInvested = positions.reduce((s, x) => s + x.shares * x.buyPrice, 0) || inv.invested;
      return { ...inv, positions, value: Math.round(newValue), invested: Math.round(newInvested) };
    }));
    setPosForm(emptyPos); setEditItem(null); setModal("drill");
  };

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
    { id: "overview", label: "Vue d'ensemble", icon: "⬡" },
    { id: "cashflow", label: "Flux", icon: "⇄" },
    { id: "investments", label: "Investissements", icon: "◈" },
    { id: "assets", label: "Patrimoine matériel", icon: "◉" },
    { id: "budget", label: "Budget & Objectifs", icon: "◎" },
    { id: "projection", label: "Projection", icon: "⟿" },
  ];

  // ── Shared form grid ───────────────────────────────────────────────────────
  const FRow = ({ cols = 2, children }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, marginBottom: 14 }}>{children}</div>;
  const FField = ({ label, children }) => <div><Label>{label}</Label>{children}</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#080e1a", color: "#f1f5f9", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
        input::placeholder,textarea::placeholder{color:#374151}
        input:focus,select:focus,textarea:focus{border-color:rgba(16,185,129,.5)!important;outline:none}
        input[type=range]{accent-color:#10b981;cursor:pointer;width:100%}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 28px", position: "sticky", top: 0, background: "#080e1a", zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 }}>₣</div>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.02em" }}>FinLib</span>
            <span style={{ fontSize: 10, background: "rgba(16,185,129,.15)", color: "#10b981", padding: "2px 8px", borderRadius: 20, marginLeft: 4 }}>PRO</span>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "rgba(16,185,129,.12)" : "transparent", border: "none", color: tab === t.id ? "#10b981" : "#6b7280", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all .15s" }}>
                <span style={{ fontSize: 10 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {alerts.length > 0 && <div style={{ background: "rgba(251,146,60,.15)", color: "#fb923c", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>⚠ {alerts.length} alerte{alerts.length > 1 ? "s" : ""}</div>}
            <div style={{ fontSize: 11, color: "#4b5563" }}>{new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px" }}>

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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              <KPI label="Patrimoine total" value={fEur(patrimoine, true)} sub={fPct((pnlTotal / (invInvested + healthCost)) * 100)} icon="🏛️" />
              <KPI label="Actifs financiers" value={fEur(invTotal, true)} icon="📈" accent="#10b981" />
              <KPI label="Patrimoine matériel" value={fEur(healthTotal, true)} icon="🏠" accent="#60a5fa" />
              <KPI label="Revenus du mois" value={fEur(income, true)} icon="💰" />
              <KPI label="Taux d'épargne" value={Math.round(savingsRate) + "%"} sub={fEur(balance) + " épargnés"} accent={balance >= 0 ? "#10b981" : "#f87171"} icon="🎯" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
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

        {/* ── INVESTMENTS ── */}
        {tab === "investments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Investissements</h1>
                <p style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>Cliquez sur un actif pour voir le détail des positions</p>
              </div>
              <button onClick={() => { setEditItem(null); setInvForm(emptyInv); setModal("inv"); }} style={btnG}>+ Actif</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              <KPI label="Patrimoine financier" value={fEur(invTotal, true)} icon="🏛️" />
              <KPI label="Capital investi" value={fEur(invInvested, true)} icon="💸" />
              <KPI label="Plus-values" value={fEur(invTotal - invInvested, true)} accent={(invTotal - invInvested) >= 0 ? "#4ade80" : "#f87171"} icon="📊" />
              <KPI label="Performance" value={fPct(invInvested > 0 ? ((invTotal - invInvested) / invInvested) * 100 : 0)} accent={invTotal >= invInvested ? "#10b981" : "#f87171"} icon="⚡" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
              <div style={{ ...card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Allocation</h3>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={investments} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={4} dataKey="value">
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
                    const pnl = inv.value - inv.invested;
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
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{fEur(inv.value)}</div>
                            <div style={{ fontSize: 11, color: pnl >= 0 ? "#4ade80" : "#f87171" }}>{pnl >= 0 ? "+" : ""}{fEur(pnl)} ({fPct(pct)})</div>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 3 }}>
                          <div style={{ width: `${(inv.value / invTotal) * 100}%`, height: "100%", background: inv.color, borderRadius: 4 }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); editInv(inv); }} style={{ ...btnS, padding: "2px 8px", fontSize: 10 }}>✎ Modifier</button>
                            <button onClick={e => { e.stopPropagation(); delInv(inv.id); }} style={{ ...btnD, padding: "2px 8px", fontSize: 10 }}>✕</button>
                          </div>
                          <span style={{ fontSize: 10, color: "#4b5563" }}>{((inv.value / invTotal) * 100).toFixed(1)}% du portefeuille</span>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
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

      {/* Drill-down investissement */}
      {modal === "drill" && drillInv && (
        <Modal title={`${drillInv.name} — Positions`} onClose={() => { setModal(null); setPosForm(emptyPos); setEditItem(null); }}>
          <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[{ l: "Valeur", v: fEur(investments.find(i => i.id === drillInv.id)?.value || 0) },
              { l: "Investi", v: fEur(investments.find(i => i.id === drillInv.id)?.invested || 0) },
              { l: "P&L", v: fEur((investments.find(i => i.id === drillInv.id)?.value || 0) - (investments.find(i => i.id === drillInv.id)?.invested || 0)) }].map(x => (
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
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{pos.shares} unités · PA {fEur(pos.buyPrice)} · Actuel {fEur(pos.currentPrice)}</div>
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
              <FField label="Ticker"><input type="text" placeholder="Ex: CW8, BTC" style={inp} value={posForm.ticker} onChange={e => setPosForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} /></FField>
              <FField label="Nom"><input type="text" placeholder="Nom complet" style={inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} /></FField>
            </FRow>
            <FRow cols={3}>
              <FField label="Quantité"><input type="number" placeholder="0" style={inp} value={posForm.shares} onChange={e => setPosForm(p => ({ ...p, shares: e.target.value }))} /></FField>
              <FField label="Prix d'achat (€)"><input type="number" placeholder="0" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
              <FField label="Prix actuel (€)"><input type="number" placeholder="0" style={inp} value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} /></FField>
            </FRow>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={savePosition} style={btnG}>{editItem?.posId ? "Modifier" : "Ajouter la position"}</button>
              {editItem?.posId && <button onClick={() => { setEditItem(null); setPosForm(emptyPos); }} style={btnS}>Annuler</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
