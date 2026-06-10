import { useState, useRef, useEffect } from 'react';
import { makeS, fEur, today, uid, PORTFOLIO_IMMO_TYPES } from '../utils/constants';

// ── Constants ──────────────────────────────────────────────────────────────────
const FORM_TYPES = {
  PEA: 'stock', CTO: 'stock',
  Crypto: 'crypto',
  Immobilier: 'realestate',
  'Assurance-vie': 'bond',
  'Épargne salariale': 'bond',
  // Old category fallbacks (investments without a 'type' field)
  Actions: 'stock',
  Obligataire: 'bond',
  'Épargne liquide': 'bond',
  Autres: 'commodity',
};
const META = {
  stock:      { icon: '📈', label: 'Action / ETF',        color: '#10b981', grad: 'linear-gradient(135deg,#052e16,#065f46)' },
  crypto:     { icon: '🪙', label: 'Cryptomonnaie',       color: '#f59e0b', grad: 'linear-gradient(135deg,#451a03,#78350f)' },
  realestate: { icon: '🏠', label: 'Bien immobilier',     color: '#fb923c', grad: 'linear-gradient(135deg,#431407,#9a3412)' },
  bond:       { icon: '🛡️', label: 'Fonds / Obligations', color: '#a78bfa', grad: 'linear-gradient(135deg,#2e1065,#4c1d95)' },
  commodity:  { icon: '🥇', label: 'Matière première',    color: '#facc15', grad: 'linear-gradient(135deg,#422006,#854d0e)' },
};
const COMMODITY_TYPES = ['Or', 'Argent', 'Platine', 'Palladium', 'Cuivre', 'Autre'];
const COMMODITY_UNITS = ['grammes', 'onces troy', 'kilogrammes'];
const CRYPTO_PLATFORMS = ['Binance', 'Coinbase', 'Kraken', 'Bybit', 'Ledger (HW)', 'Trezor (HW)', 'MetaMask', 'Autre'];
const AV_INSURERS = ['AXA', 'Generali', 'Spirica', 'Apicil', 'Suravenir', 'Predica (CA)', 'Autre'];

// ── Micro-components ───────────────────────────────────────────────────────────
const LBL = ({ children, auto }) => (
  <label style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
    {children}
    {auto && (
      <span style={{ color: '#4ade80', fontSize: 10, background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.2)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: 0 }}>
        ✓ Auto
      </span>
    )}
  </label>
);
const FF = ({ label, auto, span, children }) => (
  <div style={span === 2 ? { gridColumn: 'span 2' } : {}}>
    <LBL auto={auto}>{label}</LBL>
    {children}
  </div>
);
const Spinner = ({ color }) => (
  <span style={{ width: 14, height: 14, border: `2px solid rgba(255,255,255,.25)`, borderTopColor: color || '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
);

// ── Main component ─────────────────────────────────────────────────────────────
export default function PositionFormModal({ T, data }) {
  const {
    modal, drillInv, setModal, posForm, setPosForm, mkPos, editItem, setEditItem,
    fetchTickerPrice, fetchingPrice, prices, computedLoans, setInvestments,
  } = data;

  const S = makeS(T);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [autoFilled, setAutoFilled] = useState(new Set());
  const debounceRef = useRef(null);
  const sugRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = e => { if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset local state when modal closes
  useEffect(() => {
    if (modal !== 'drill') {
      setAutoFilled(new Set());
      setSuggestions([]);
      setShowSug(false);
    }
  }, [modal]);

  if (modal !== 'drill' || !drillInv) return null;

  const formType = FORM_TYPES[drillInv.type] ?? FORM_TYPES[drillInv.category] ?? 'stock';
  const meta = META[formType];
  const mark = (...fields) => setAutoFilled(prev => new Set([...prev, ...fields]));
  const isAuto = f => autoFilled.has(f);

  const inp = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8,
    color: T.text, padding: '9px 12px', fontSize: 13, outline: 'none', width: '100%',
    fontFamily: 'inherit',
  };
  const inpAuto = { ...inp, borderColor: 'rgba(74,222,128,.35)', background: 'rgba(74,222,128,.04)' };

  const onClose = () => { setModal(null); setPosForm(mkPos()); setEditItem(null); };

  // ── Stock search ─────────────────────────────────────────────────────────────
  const searchStock = async (query) => {
    if (!query || query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/search?type=stock&q=${encodeURIComponent(query)}`);
      const results = await res.json();
      if (results?.length) {
        const first = results[0];
        setPosForm(p => ({
          ...p,
          ticker:   first.symbol || p.ticker,
          name:     p.name || first.name || '',
          exchange: first.exchange || p.exchange || '',
        }));
        mark('ticker', 'name', 'exchange');
        fetchTickerPrice(/^[A-Z]{2}[A-Z0-9]{10}$/.test(query) ? query : first.symbol);
      }
    } catch (err) { console.error('[searchStock]', err.message); }
    setSearching(false);
  };

  const handleIsinChange = (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    setPosForm(p => ({ ...p, isin: v }));
  };
  const handleIsinBlur = (e) => {
    const v = e.target.value.trim().toUpperCase();
    if (v.length >= 2) searchStock(v);
  };

  // ── Crypto search ─────────────────────────────────────────────────────────────
  const handleCryptoSearch = (e) => {
    const q = e.target.value;
    setPosForm(p => ({ ...p, name: q }));
    clearTimeout(debounceRef.current);
    if (!q || q.length < 2) { setSuggestions([]); setShowSug(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?type=crypto&q=${encodeURIComponent(q)}`);
        const list = await res.json();
        setSuggestions(list || []);
        setShowSug(true);
      } catch {}
      setSearching(false);
    }, 350);
  };

  const selectCoin = async (coin) => {
    setShowSug(false);
    setSuggestions([]);
    setPosForm(p => ({ ...p, name: coin.name, ticker: coin.symbol }));
    mark('name', 'ticker');
    fetchTickerPrice(coin.symbol);
  };

  // ── Save handler ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    const ft = formType;
    const needsId = ft === 'stock' || ft === 'crypto';
    if (needsId && !(posForm.isin || posForm.ticker)) return;
    if (!posForm.name && ft !== 'stock' && ft !== 'crypto') return;

    const rawShares = ft === 'realestate' || ft === 'bond' ? '1' : posForm.shares;
    const qty = parseFloat(rawShares) || 0;
    const bp  = parseFloat(posForm.buyPrice) || 0;
    if (!qty || !bp) return;

    const liveKey = posForm.isin || posForm.ticker;
    const livePx  = liveKey ? (prices[liveKey] ?? null) : null;
    const currentPrice = parseFloat(posForm.currentPrice) || livePx || bp;

    const pos = {
      ...posForm,
      id:           editItem?.posId || uid(),
      posType:      ft,
      shares:       qty,
      buyPrice:     bp,
      currentPrice,
      divYield:     parseFloat(posForm.divYield) || 0,
      purchaseDate: posForm.purchaseDate || today(),
    };

    setInvestments(p => p.map(inv => {
      if (inv.id !== drillInv.id) return inv;
      const positions = editItem?.posId
        ? inv.positions.map(x => x.id === editItem.posId ? pos : x)
        : [...(inv.positions || []), pos];
      return { ...inv, positions };
    }));

    setPosForm(mkPos());
    setEditItem(null);
    setModal(null);
  };

  // ── Preview ───────────────────────────────────────────────────────────────────
  const qty = parseFloat(posForm.shares) || (formType === 'realestate' || formType === 'bond' ? 1 : 0);
  const bp  = parseFloat(posForm.buyPrice) || 0;
  const liveKey = posForm.isin || posForm.ticker;
  const livePx  = (liveKey ? prices[liveKey] : null) ?? (parseFloat(posForm.currentPrice) || 0);
  const invested  = qty * bp;
  const curVal    = qty * livePx;
  const pnl       = curVal - invested;
  const pnlPct    = invested > 0 ? (pnl / invested) * 100 : 0;
  const hasPreview = (formType === 'realestate' || formType === 'bond') ? bp > 0 : qty > 0 && bp > 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}
    >
      <div style={{ background: T.bg3, border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, width: '100%', maxWidth: 640, margin: '0 16px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>

        {/* ── Colored header ── */}
        <div style={{ background: meta.grad, padding: '22px 28px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 50, height: 50, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
              {meta.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{meta.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                {editItem?.posId ? 'Modifier la position' : 'Nouvelle position'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{drillInv.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, color: '#fff', padding: '6px 13px', fontSize: 20, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '26px 28px' }}>

          {/* ══ STOCK / ETF ══════════════════════════════════════════════════════ */}
          {formType === 'stock' && (
            <>
              {/* ISIN + search button */}
              <div style={{ marginBottom: 14 }}>
                <LBL auto={isAuto('isin')}>Code ISIN</LBL>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="IE00B4L5Y983, FR0010315770…"
                    maxLength={12}
                    style={{ ...inp, textTransform: 'uppercase', fontFamily: 'ui-monospace,monospace', letterSpacing: '.06em', flex: 1, ...(isAuto('isin') ? { borderColor: 'rgba(74,222,128,.35)' } : {}) }}
                    value={posForm.isin}
                    onChange={handleIsinChange}
                    onBlur={handleIsinBlur}
                  />
                  <button
                    onClick={() => searchStock(posForm.isin)}
                    disabled={searching || !posForm.isin}
                    style={{ background: meta.grad, border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: posForm.isin ? 'pointer' : 'not-allowed', opacity: !posForm.isin ? 0.4 : 1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7 }}
                  >
                    {searching ? <Spinner /> : '🔍'}
                    {searching ? 'Recherche…' : 'Rechercher'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>
                  Saisissez un ISIN (12 car.) ou un ticker puis cliquez Rechercher pour auto-compléter
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Nom complet" auto={isAuto('name')}>
                  <input type="text" placeholder="MSCI World UCITS ETF…" style={isAuto('name') ? inpAuto : inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} />
                </FF>
                <FF label="Ticker" auto={isAuto('ticker')}>
                  <input
                    type="text"
                    placeholder="CW8.PA, AAPL, MC.PA…"
                    style={{ ...(isAuto('ticker') ? inpAuto : inp), textTransform: 'uppercase' }}
                    value={posForm.ticker}
                    onChange={e => setPosForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                    onBlur={e => { if (!posForm.isin && e.target.value) fetchTickerPrice(e.target.value.toUpperCase()); }}
                  />
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Place de cotation" auto={isAuto('exchange')}>
                  <input type="text" placeholder="Euronext Paris, NYSE…" style={isAuto('exchange') ? inpAuto : inp} value={posForm.exchange || ''} onChange={e => setPosForm(p => ({ ...p, exchange: e.target.value }))} />
                </FF>
                <FF label="Devise">
                  <select style={inp} value={posForm.currency || 'EUR'} onChange={e => setPosForm(p => ({ ...p, currency: e.target.value }))}>
                    {['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
                <FF label="Nb de parts">
                  <input type="number" placeholder="0" min="0" step="any" style={inp} value={posForm.shares} onChange={e => setPosForm(p => ({ ...p, shares: e.target.value }))} />
                </FF>
                <FF label="PRU (€)">
                  <input type="number" placeholder="0.00" min="0" step="any" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} />
                </FF>
                <FF label={fetchingPrice ? 'Récupération…' : prices[liveKey] != null ? 'Prix LIVE ●' : 'Prix actuel (€)'} auto={prices[liveKey] != null}>
                  <input type="number" placeholder="Auto via ISIN" min="0" step="any" style={{ ...(prices[liveKey] != null ? inpAuto : inp), opacity: fetchingPrice ? 0.5 : 1 }} value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} />
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Date d'achat">
                  <input type="date" style={inp} value={posForm.purchaseDate || ''} onChange={e => setPosForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                </FF>
                <FF label="Rendement dividende (%)">
                  <input type="number" placeholder="0.00" min="0" step="0.01" style={inp} value={posForm.divYield || ''} onChange={e => setPosForm(p => ({ ...p, divYield: e.target.value }))} />
                </FF>
              </div>

              <div style={{ marginBottom: 14 }}>
                <FF label="Notes">
                  <input type="text" placeholder="Stratégie DCA, objectif de vente…" style={inp} value={posForm.notes || ''} onChange={e => setPosForm(p => ({ ...p, notes: e.target.value }))} />
                </FF>
              </div>
            </>
          )}

          {/* ══ CRYPTO ═══════════════════════════════════════════════════════════ */}
          {formType === 'crypto' && (
            <>
              <div style={{ marginBottom: 14, position: 'relative' }} ref={sugRef}>
                <LBL>Rechercher une crypto</LBL>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Bitcoin, Ethereum, Solana…"
                    style={{ ...inp, paddingRight: searching ? 38 : 12 }}
                    value={posForm.name}
                    onChange={handleCryptoSearch}
                    onFocus={() => suggestions.length > 0 && setShowSug(true)}
                  />
                  {searching && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      <Spinner color={meta.color} />
                    </span>
                  )}
                </div>
                {showSug && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}>
                    {suggestions.map(coin => (
                      <button
                        key={coin.id}
                        onMouseDown={() => selectCoin(coin)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${T.cardBorder}`, cursor: 'pointer', color: T.text, textAlign: 'left' }}
                        onMouseEnter={e => { e.currentTarget.style.background = T.cardBg; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        {coin.thumb ? (
                          <img src={coin.thumb} alt="" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🪙</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{coin.name}</div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{coin.symbol}{coin.rank ? ` · #${coin.rank} market cap` : ''}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Symbole" auto={isAuto('ticker')}>
                  <input
                    type="text"
                    placeholder="BTC, ETH, SOL…"
                    style={{ ...(isAuto('ticker') ? inpAuto : inp), textTransform: 'uppercase' }}
                    value={posForm.ticker}
                    onChange={e => setPosForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                    onBlur={e => { if (e.target.value) fetchTickerPrice(e.target.value.toUpperCase()); }}
                  />
                </FF>
                <FF label={fetchingPrice ? 'Récupération…' : prices[posForm.ticker] != null ? 'Prix LIVE ●' : 'Prix actuel (€)'} auto={prices[posForm.ticker] != null}>
                  <input type="number" placeholder="Auto via CoinGecko" min="0" step="any" style={{ ...(prices[posForm.ticker] != null ? inpAuto : inp), opacity: fetchingPrice ? 0.5 : 1 }} value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} />
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
                <FF label="Quantité">
                  <input type="number" placeholder="0.001" min="0" step="any" style={inp} value={posForm.shares} onChange={e => setPosForm(p => ({ ...p, shares: e.target.value }))} />
                </FF>
                <FF label="DCA / Prix moyen (€)">
                  <input type="number" placeholder="0.00" min="0" step="any" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} />
                </FF>
                <FF label="Plateforme">
                  <select style={inp} value={posForm.platform || ''} onChange={e => setPosForm(p => ({ ...p, platform: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {CRYPTO_PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
                  </select>
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Date d'achat">
                  <input type="date" style={inp} value={posForm.purchaseDate || ''} onChange={e => setPosForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                </FF>
                <FF label="Notes">
                  <input type="text" placeholder="Cold wallet, staking…" style={inp} value={posForm.notes || ''} onChange={e => setPosForm(p => ({ ...p, notes: e.target.value }))} />
                </FF>
              </div>
            </>
          )}

          {/* ══ IMMOBILIER ═══════════════════════════════════════════════════════ */}
          {formType === 'realestate' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <FF label="Description du bien">
                  <input type="text" placeholder="Appartement Paris 11e, SCPI Corum…" style={inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Type de bien">
                  <select style={inp} value={posForm.propertyType || 'Locatif'} onChange={e => setPosForm(p => ({ ...p, propertyType: e.target.value }))}>
                    {PORTFOLIO_IMMO_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FF>
                <FF label="Surface (m²)">
                  <input type="number" placeholder="0" min="0" style={inp} value={posForm.surface || ''} onChange={e => setPosForm(p => ({ ...p, surface: e.target.value }))} />
                </FF>
              </div>
              <div style={{ marginBottom: 14 }}>
                <FF label="Adresse">
                  <input type="text" placeholder="12 rue des Lilas, 75011 Paris" style={inp} value={posForm.address || ''} onChange={e => setPosForm(p => ({ ...p, address: e.target.value }))} />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Valeur d'achat (€)">
                  <input type="number" placeholder="0" min="0" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value, purchaseValue: e.target.value }))} />
                </FF>
                <FF label="Valeur actuelle estimée (€)">
                  <input type="number" placeholder="0" min="0" style={inp} value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value, estimatedValue: e.target.value }))} />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Date d'acquisition">
                  <input type="date" style={inp} value={posForm.purchaseDate || ''} onChange={e => setPosForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                </FF>
                <FF label="Loyer mensuel (€)">
                  <input type="number" placeholder="0" min="0" style={inp} value={posForm.monthlyRent || ''} onChange={e => setPosForm(p => ({ ...p, monthlyRent: e.target.value }))} />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Charges mensuelles (€)">
                  <input type="number" placeholder="0" min="0" style={inp} value={posForm.monthlyCharges || ''} onChange={e => setPosForm(p => ({ ...p, monthlyCharges: e.target.value }))} />
                </FF>
                <FF label="Crédit associé (optionnel)">
                  <select style={inp} value={posForm.linkedLoanId || ''} onChange={e => setPosForm(p => ({ ...p, linkedLoanId: e.target.value }))}>
                    <option value="">— Aucun crédit lié —</option>
                    {computedLoans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </FF>
              </div>
              <div style={{ marginBottom: 14 }}>
                <FF label="Notes">
                  <input type="text" placeholder="Remarques, travaux prévus…" style={inp} value={posForm.notes || ''} onChange={e => setPosForm(p => ({ ...p, notes: e.target.value }))} />
                </FF>
              </div>
            </>
          )}

          {/* ══ FONDS / OBLIGATIONS ══════════════════════════════════════════════ */}
          {formType === 'bond' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Nom du fonds">
                  <input type="text" placeholder="Fonds euros Generali, OAT 2035…" style={inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} />
                </FF>
                <FF label="Assureur / Émetteur">
                  <select style={inp} value={posForm.insurer || ''} onChange={e => setPosForm(p => ({ ...p, insurer: e.target.value }))}>
                    <option value="">— Sélectionner —</option>
                    {AV_INSURERS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Montant investi (€)">
                  <input type="number" placeholder="0" min="0" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} />
                </FF>
                <FF label="Taux garanti (%)">
                  <input
                    type="number"
                    placeholder="2.50"
                    min="0"
                    step="0.01"
                    style={inp}
                    value={posForm.guaranteedRate || ''}
                    onChange={e => {
                      const rate = e.target.value;
                      setPosForm(p => {
                        const invested = parseFloat(p.buyPrice) || 0;
                        const newCurrent = rate && invested ? String(+(invested * (1 + parseFloat(rate) / 100)).toFixed(2)) : p.currentPrice;
                        return { ...p, guaranteedRate: rate, currentPrice: newCurrent };
                      });
                    }}
                  />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Valeur actuelle (€)" auto={!!posForm.guaranteedRate && !!posForm.buyPrice}>
                  <input type="number" placeholder="0" min="0" style={posForm.guaranteedRate && posForm.buyPrice ? inpAuto : inp} value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} />
                </FF>
                <FF label="Date d'investissement">
                  <input type="date" style={inp} value={posForm.purchaseDate || ''} onChange={e => setPosForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                </FF>
              </div>
              <div style={{ marginBottom: 14 }}>
                <FF label="Notes">
                  <input type="text" placeholder="Durée, objectif, observations…" style={inp} value={posForm.notes || ''} onChange={e => setPosForm(p => ({ ...p, notes: e.target.value }))} />
                </FF>
              </div>
            </>
          )}

          {/* ══ MATIÈRES PREMIÈRES ═══════════════════════════════════════════════ */}
          {formType === 'commodity' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Type">
                  <select style={inp} value={posForm.commodityType || 'Or'} onChange={e => setPosForm(p => ({ ...p, commodityType: e.target.value, name: p.name || e.target.value }))}>
                    {COMMODITY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FF>
                <FF label="Nom / Description">
                  <input type="text" placeholder="Lingot 250g, Pièce Napoléon…" style={inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
                <FF label="Quantité">
                  <input type="number" placeholder="0" min="0" step="any" style={inp} value={posForm.shares} onChange={e => setPosForm(p => ({ ...p, shares: e.target.value }))} />
                </FF>
                <FF label="Unité">
                  <select style={inp} value={posForm.unit || 'grammes'} onChange={e => setPosForm(p => ({ ...p, unit: e.target.value }))}>
                    {COMMODITY_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </FF>
                <FF label="Prix d'achat unitaire (€)">
                  <input type="number" placeholder="0.00" min="0" step="any" style={inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} />
                </FF>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FF label="Prix actuel unitaire (€)">
                  <input type="number" placeholder="0.00" min="0" step="any" style={inp} value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} />
                </FF>
                <FF label="Lieu de stockage">
                  <input type="text" placeholder="Coffre bancaire, Domicile…" style={inp} value={posForm.storageLocation || ''} onChange={e => setPosForm(p => ({ ...p, storageLocation: e.target.value }))} />
                </FF>
              </div>
              <div style={{ marginBottom: 14 }}>
                <FF label="Notes">
                  <input type="text" placeholder="Lingot certifié, pièces millésime…" style={inp} value={posForm.notes || ''} onChange={e => setPosForm(p => ({ ...p, notes: e.target.value }))} />
                </FF>
              </div>
            </>
          )}

          {/* ── Preview card ────────────────────────────────────────────────────── */}
          {hasPreview && (
            <div style={{ background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Aperçu de la position</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Investi', val: fEur(invested), color: '#60a5fa' },
                  { label: livePx > 0 ? 'Valeur actuelle' : 'Valeur achat', val: fEur(livePx > 0 ? curVal : invested), color: T.text },
                  { label: 'P&L estimé', val: `${pnl >= 0 ? '+' : ''}${fEur(pnl)}${pnlPct !== 0 ? ` (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)` : ''}`, color: pnl >= 0 ? '#4ade80' : '#f87171' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 8px' }}>
                    <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {formType === 'bond' && posForm.guaranteedRate && parseFloat(posForm.guaranteedRate) > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}`, fontSize: 12, color: meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                  💸 Intérêts annuels estimés : <strong>+{fEur(invested * parseFloat(posForm.guaranteedRate) / 100)}</strong>
                  <span style={{ color: T.textMuted }}>({posForm.guaranteedRate}%/an)</span>
                </div>
              )}

              {formType === 'realestate' && posForm.monthlyRent && parseFloat(posForm.monthlyRent) > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}`, fontSize: 12, color: meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🏠 Rendement locatif brut :
                  <strong>{bp > 0 ? ((parseFloat(posForm.monthlyRent) * 12 / bp) * 100).toFixed(2) + '%' : '—'}/an</strong>
                  <span style={{ color: T.textMuted }}>({fEur(parseFloat(posForm.monthlyRent))}/mois)</span>
                </div>
              )}

              {formType === 'commodity' && posForm.unit && posForm.shares && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}`, fontSize: 12, color: T.textMuted }}>
                  {posForm.shares} {posForm.unit} · {posForm.name || posForm.commodityType || 'Matière première'}
                </div>
              )}
            </div>
          )}

          {/* ── Submit buttons ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              style={{ ...S.btnG, flex: 1, padding: '13px', fontSize: 14, borderRadius: 12, background: meta.grad }}
            >
              {editItem?.posId ? '✓ Enregistrer les modifications' : `+ Ajouter à ${drillInv.name}`}
            </button>
            <button onClick={onClose} style={{ ...S.btnS, padding: '13px 20px', fontSize: 14, borderRadius: 12 }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
