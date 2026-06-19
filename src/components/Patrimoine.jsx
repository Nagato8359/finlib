import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { KPI, makeS, fEur, fPct, fDate, INV_COLORS, CASH_TYPE_COLORS, CASH_TYPE_INFO, LISTING_CAT_COLORS, PORTFOLIO_TYPE_ICON, PORTFOLIO_TYPE_COLOR, getInvFormType, uid, today, mLeft } from '../utils/constants';
import { useTranslation } from '../hooks/useTranslation';
import { AssetLogo, stockLogoSources, scpiLogoSources } from './Modals';

// ── Loan simulator helpers ────────────────────────────────────────────────────
const calcMonthsToPayoff = (capital, annualRate, monthlyPayment) => {
  if (monthlyPayment <= 0 || capital <= 0) return Infinity;
  const r = annualRate / 100 / 12;
  if (r <= 0) return Math.ceil(capital / monthlyPayment);
  const denom = monthlyPayment - capital * r;
  if (denom <= 0) return Infinity;
  return Math.ceil(-Math.log(denom / monthlyPayment) / Math.log(1 + r));
};

const balAtMonth = (capital, annualRate, monthlyPayment, m) => {
  const r = annualRate / 100 / 12;
  if (r <= 0) return Math.max(0, capital - monthlyPayment * m);
  return Math.max(0, capital * Math.pow(1 + r, m) - monthlyPayment * ((Math.pow(1 + r, m) - 1) / r));
};

const addMonths = (date, m) => {
  const d = new Date(date || Date.now());
  d.setMonth(d.getMonth() + m);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

const COMMODITY_EMOJI_MAP = {
  or: '🥇', gold: '🥇', xau: '🥇',
  argent: '🪙', silver: '🪙', xag: '🪙',
  platine: '⬜', platinum: '⬜', xpt: '⬜',
  palladium: '⬜', xpd: '⬜',
  'pétrole': '🛢️', petrol: '🛢️', oil: '🛢️', brent: '🛢️', wti: '🛢️',
  cuivre: '🔶', copper: '🔶',
  gaz: '🔥', gas: '🔥',
  blé: '🌾', wheat: '🌾',
};
const getCommodityEmoji = name => {
  const lower = (name || '').toLowerCase();
  const key = Object.keys(COMMODITY_EMOJI_MAP).find(k => lower.includes(k));
  return key ? COMMODITY_EMOJI_MAP[key] : '⛏️';
};

export default function Patrimoine({ T, data }) {
  const S = makeS(T);
  const { t } = useTranslation();
  const [section, setSection] = useState('invest');
  const [loanSim, setLoanSim] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [cashModal, setCashModal] = useState(null);
  const [cashOpMode, setCashOpMode] = useState('add');
  const [cashOpAmt, setCashOpAmt] = useState('');
  const [rentData, setRentData]       = useState(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [rentError, setRentError]     = useState('');
  const [rentTf, setRentTf]           = useState('12M');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg]         = useState('');
  const [estimationImmo, setEstimationImmo] = useState(null);
  const [estimationLoading, setEstimationLoading] = useState(false);
  const [estimationError, setEstimationError] = useState('');
  const [estForm, setEstForm] = useState({ adresse: '', surface: '', type: 'appartement', etat: 'bon', options: [] });
  const [loyerForm, setLoyerForm] = useState({ show: false, montant: '', date: today(), compteId: '' });

  const SECTIONS = [
    { id: 'invest',   label: t('pat_invest')   },
    { id: 'cash',     label: t('pat_cash')     },
    { id: 'materiel', label: t('pat_materiel') },
    { id: 'loans',    label: t('pat_loans')    },
  ];

  const {
    investments, invTotal, invInvested, invLiveValue, invLiveInvested, priceStatus, lastUpdated, fetchPrices,
    computedSavings, setSavings, cashTotal, annualInterests, avgRate,
    healthAssets, healthTotal, healthCost,
    listings, soldHistory, setSoldHistory, listingsExpectedProfit, soldProfit, soldProfitThisYear,
    computedLoans, totalLoanDebt, linkedLoanDebt,
    patrimoine,
    setModal, setEditItem, setDrillInv, drillInv, setDivInvId,
    openEditPortfolio, delInv, openEditCash, delCash, openEditHealth, delHealth,
    openEditListing, delListing, markSold,
    openEditLoan, delLoan,
    allDividends, divThisYear, divByMonth, delDividend,
    setPosForm, mkPos, setInvestments, setTransactions,
  } = data;

  const isPro = data?.isPro || false;

  const syncCwallet = useCallback(async (inv) => {
    const addr = (inv.adresse || '').trim();
    if (!addr || !/^0x[0-9a-fA-F]{40}$/i.test(addr)) return;
    setSyncLoading(true); setSyncMsg('');
    try {
      const res = await fetch(`/api/crypto-wallet?address=${addr}&network=all`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      const incoming = [...(d.nativeBalances || []), ...(d.tokens || [])];
      setInvestments(prev => prev.map(env => {
        if (env.id !== inv.id) return env;
        const existing = [...(env.positions || [])];
        let added = 0;
        let updated = 0;
        for (const tk of incoming) {
          const idx = existing.findIndex(p => p.ticker?.toUpperCase() === tk.symbol?.toUpperCase());
          if (idx >= 0) {
            existing[idx] = { ...existing[idx], shares: tk.amount, currentPrice: tk.priceEUR || existing[idx].currentPrice };
            updated++;
          } else {
            existing.push({
              id: uid(), ticker: tk.symbol, name: tk.name,
              shares: tk.amount, buyPrice: tk.priceEUR || 0, currentPrice: tk.priceEUR || 0,
              posType: 'crypto', divYield: 0,
              isin: '', exchange: tk.network || '', currency: 'EUR', platform: '', notes: '', commodityType: '',
            });
            added++;
          }
        }
        setSyncMsg(`✓ ${updated} mis à jour, ${added} ajouté${added !== 1 ? 's' : ''}`);
        return { ...env, positions: existing };
      }));
    } catch (e) { setSyncMsg(`✗ ${e.message}`); }
    finally { setSyncLoading(false); }
  }, [setInvestments]);

  const loadRents = useCallback((inv, forceRefresh = false) => {
    if (!inv || inv.type !== 'RealT' || !/^0x[0-9a-fA-F]{40}$/i.test(inv.platform || '')) return;
    setRentLoading(true); setRentData(null); setRentError('');
    const url = `/api/realt?action=rents&address=${inv.platform}${forceRefresh ? '&refresh=true' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) { setRentError(d.error); } else { setRentData(d); } })
      .catch(e => setRentError(e.message))
      .finally(() => setRentLoading(false));
  }, []);

  // Fetch rent history when drilling into a RealT portfolio with a wallet address
  useEffect(() => {
    if (!drillInv) { setRentData(null); setRentError(''); return; }
    const inv = data.investments?.find(i => i.id === drillInv.id) || drillInv;
    loadRents(inv);
  }, [drillInv?.id, loadRents]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setEstimationImmo(null);
    setEstimationError('');
    if (!drillInv) return;
    const inv = data.investments?.find(i => i.id === drillInv.id) || drillInv;
    if (inv.type !== 'Immobilier') return;
    setEstForm(f => ({
      ...f,
      adresse: inv.adresse || f.adresse,
      surface: inv.surface ? String(inv.surface) : f.surface,
    }));
  }, [drillInv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEstimer = useCallback(async () => {
    if (!estForm.adresse || !estForm.surface) return;
    setEstimationLoading(true);
    setEstimationError('');
    setEstimationImmo(null);
    try {
      const params = new URLSearchParams({
        adresse: estForm.adresse,
        surface: estForm.surface,
        type: estForm.type,
        etat: estForm.etat,
        ...(estForm.options.length ? { options: estForm.options.join(',') } : {}),
      });
      const res = await fetch(`/api/prices?action=estimate&${params}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setEstimationImmo(d);
    } catch (e) {
      setEstimationError(e.message);
    } finally {
      setEstimationLoading(false);
    }
  }, [estForm]);

  const handleSaveLoyer = useCallback(() => {
    const { montant, date, compteId } = loyerForm;
    if (!montant || !date || !drillInv) return;
    const montantNum = parseFloat(montant);
    if (!montantNum || montantNum <= 0) return;
    const compte = computedSavings.find(c => c.id === compteId);
    const loyer = { id: uid(), date, montant: montantNum, compteId: compteId || null, compteNom: compte?.name || null };
    setInvestments(prev => prev.map(inv =>
      inv.id !== drillInv.id ? inv : { ...inv, loyers: [...(inv.loyers || []), loyer] }
    ));
    if (compteId && compte) {
      setSavings(prev => prev.map(a =>
        a.id !== compteId ? a : { ...a, balance: (parseFloat(a.balance) || 0) + montantNum }
      ));
    }
    setLoyerForm(f => ({ ...f, show: false, montant: '', date: today() }));
  }, [loyerForm, drillInv, computedSavings, setInvestments, setSavings]);

  const SubNav = () => (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
      {SECTIONS.map(s => (
        <button key={s.id} onClick={() => setSection(s.id)}
          style={{ background: section === s.id ? T.accent + '1e' : T.cardBg, border: `1px solid ${section === s.id ? T.accent : T.cardBorder}`, color: section === s.id ? T.accent : T.textMuted, borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: section === s.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}>
          {s.label}
        </button>
      ))}
    </div>
  );

  // ── Investissements ────────────────────────────────────────────────────────
  const invFormType = getInvFormType;

  const renderInvest = () => {
    // ── Vue détail (drill-down) ───────────────────────────────────────────────
    if (drillInv) {
      const cur = investments.find(i => i.id === drillInv.id) || drillInv;
      const curCash = parseFloat(cur.cash) || 0;
      const lv = invLiveValue(cur);        // total : positions + liquidités
      const posLv = lv - curCash;         // valeur positions seules
      const li = invLiveInvested(cur);
      const pnl = posLv - li;             // PnL sur positions uniquement
      const pct = li > 0 ? (pnl / li) * 100 : 0;
      const type = cur.type || 'Autre';
      const typeIcon = PORTFOLIO_TYPE_ICON[type] || '📦';
      const typeColor = PORTFOLIO_TYPE_COLOR[type] || '#94a3b8';
      const showPositions = type !== 'Immobilier';
      const invDivs = (cur.dividends || []);
      const invDivTotal = invDivs.reduce((s, d) => s + d.amount, 0);
      const now = new Date();
      const cy = now.getFullYear();

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setDrillInv(null)} style={{ ...S.btnS, fontSize: 12, padding: '5px 12px' }}>{t('inv_back')}</button>
            <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{cur.name}</span>
            <span style={{ fontSize: 11, background: typeColor + '22', color: typeColor, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{typeIcon} {type}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {cur.type === 'Crypto' && /^0x[0-9a-fA-F]{40}$/i.test(cur.adresse || '') && (
                <>
                  <button onClick={() => { setSyncMsg(''); syncCwallet(cur); }} disabled={syncLoading}
                    style={{ ...S.btnS, fontSize: 11, padding: '4px 10px', color: '#F59E0B', borderColor: 'rgba(245,158,11,.4)', opacity: syncLoading ? 0.6 : 1 }}>
                    {syncLoading ? '…' : '🔄 Sync wallet'}
                  </button>
                  {syncMsg && <span style={{ fontSize: 10, color: syncMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{syncMsg}</span>}
                </>
              )}
              <button onClick={() => openEditPortfolio(cur)} style={{ ...S.btnS, fontSize: 11, padding: '4px 10px' }}>{t('inv_edit')}</button>
              <button onClick={() => setConfirmDel({ msg: `Supprimer l'enveloppe "${cur.name}" ? Cette action est irréversible et supprimera tous les actifs associés.`, fn: () => { setDrillInv(null); delInv(cur.id); } })} style={{ ...S.btnD, fontSize: 11, padding: '4px 10px' }}>✕</button>
            </div>
          </div>

          {/* KPIs */}
          <div className="g4">
            <KPI T={T} label={t('inv_current_value')} value={fEur(lv, true)} accent={typeColor} icon={typeIcon} />
            <KPI T={T} label={t('inv_capital')} value={fEur(li, true)} icon="💸" />
            <KPI T={T} label={t('inv_pnl')} value={fEur(pnl, true)} accent={pnl >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
            <KPI T={T} label={t('inv_perf')} value={fPct(pct)} accent={pnl >= 0 ? T.accent : '#f87171'} icon="⚡" />
          </div>

          {/* Breakdown liquidités + positions */}
          {curCash > 0 && (
            <div style={{ ...S.card, padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 0, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', padding: '0 18px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>💶 Liquidités</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#4ade80' }}>{fEur(curCash)}</div>
                </div>
                <div style={{ color: T.cardBorder, fontSize: 22, padding: '0 4px', fontWeight: 200 }}>+</div>
                <div style={{ textAlign: 'center', padding: '0 18px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>📈 Positions</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{fEur(posLv)}</div>
                </div>
                <div style={{ color: T.cardBorder, fontSize: 22, padding: '0 4px', fontWeight: 200 }}>=</div>
                <div style={{ textAlign: 'center', padding: '0 18px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>🏛️ Total enveloppe</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: typeColor }}>{fEur(lv)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Infos type-spécifiques */}
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 12, color: T.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('inv_details')}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {/* PEA / CTO */}
              {(type === 'PEA' || type === 'CTO') && cur.courtier && (
                <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_courtier')} : <strong style={{ color: T.text }}>{cur.courtier}</strong></span>
              )}
              {cur.openDate && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_open_date')} : <strong style={{ color: T.text }}>{fDate(cur.openDate)}</strong></span>}
              {type === 'PEA' && cur.openDate && (() => {
                const fiveYears = new Date(new Date(cur.openDate).getFullYear() + 5, new Date(cur.openDate).getMonth(), new Date(cur.openDate).getDate());
                const passed = now >= fiveYears;
                return <span style={{ fontSize: 12, color: passed ? '#4ade80' : '#fb923c' }}>{passed ? t('inv_pea_tax_ok') : `${t('inv_pea_tax_wait')}: ${fiveYears.toLocaleDateString('fr-FR')}`}</span>;
              })()}

              {/* Assurance-vie */}
              {type === 'Assurance-vie' && (
                <>
                  {cur.assureur && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_assurer')} : <strong style={{ color: T.text }}>{cur.assureur}</strong></span>}
                  {cur.avType && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_wallet_type')} : <strong style={{ color: T.text }}>{cur.avType}</strong></span>}
                  {cur.openDate && (() => {
                    const eight = new Date(new Date(cur.openDate).getFullYear() + 8, new Date(cur.openDate).getMonth(), new Date(cur.openDate).getDate());
                    const passed = now >= eight;
                    return <span style={{ fontSize: 12, color: passed ? '#4ade80' : '#fb923c' }}>{passed ? t('inv_av_tax_ok') : `${t('inv_av_tax_wait')}: ${eight.toLocaleDateString('fr-FR')}`}</span>;
                  })()}
                </>
              )}

              {/* Crypto */}
              {type === 'Crypto' && (
                <>
                  {cur.platform && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_platform')} : <strong style={{ color: T.text }}>{cur.platform}</strong></span>}
                  {cur.walletType && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_wallet_type')} : <strong style={{ color: T.text }}>{cur.walletType}</strong></span>}
                </>
              )}

              {/* Matières premières */}
              {type === 'Matières premières' && cur.adresse && (
                <span style={{ fontSize: 12, color: T.textMuted }}>Stockage : <strong style={{ color: T.text }}>{cur.adresse}</strong></span>
              )}

              {/* Immobilier */}
              {type === 'Immobilier' && (
                <>
                  {cur.immoBien && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_wallet_type')} : <strong style={{ color: T.text }}>{cur.immoBien}</strong></span>}
                  {cur.adresse && <span style={{ fontSize: 12, color: T.textMuted }}>{t('pos_address')} : <strong style={{ color: T.text }}>{cur.adresse}</strong></span>}
                  {cur.loyerMensuel > 0 && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_rent')} : <strong style={{ color: '#4ade80' }}>{fEur(cur.loyerMensuel)}/mois</strong></span>}
                  {cur.chargesMensuelles > 0 && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_charges')} : <strong style={{ color: '#f87171' }}>{fEur(cur.chargesMensuelles)}/mois</strong></span>}
                  {cur.loyerMensuel > 0 && lv > 0 && (
                    <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_brut_yield')} : <strong style={{ color: typeColor }}>{((cur.loyerMensuel * 12 / lv) * 100).toFixed(2)}%</strong></span>
                  )}
                  {cur.loyerMensuel > 0 && cur.chargesMensuelles > 0 && (
                    <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_net_cashflow')} : <strong style={{ color: (cur.loyerMensuel - cur.chargesMensuelles) >= 0 ? '#4ade80' : '#f87171' }}>{fEur(cur.loyerMensuel - cur.chargesMensuelles)}/mois</strong></span>
                  )}
                </>
              )}

              {/* Crowdfunding immobilier */}
              {['La Première Brique', 'Tantiem', 'Bricks.co', 'Crowdfunding immobilier'].includes(type) && cur.platform && (
                <span style={{ fontSize: 12, color: T.textMuted }}>Plateforme : <strong style={{ color: T.text }}>{cur.platform}</strong></span>
              )}

              {/* SCPI / OPCI / SCI */}
              {['SCPI', 'OPCI', 'SCI'].includes(type) && (
                <>
                  {cur.courtier && <span style={{ fontSize: 12, color: T.textMuted }}>Sté de gestion : <strong style={{ color: T.text }}>{cur.courtier}</strong></span>}
                  {cur.adresse && <span style={{ fontSize: 12, color: T.textMuted }}>Fonds : <strong style={{ color: T.text }}>{cur.adresse}</strong></span>}
                </>
              )}

              {/* Private Equity / Crowdfunding entreprise */}
              {['Private Equity', 'Crowdfunding entreprise'].includes(type) && (
                <>
                  {cur.courtier && <span style={{ fontSize: 12, color: T.textMuted }}>Plateforme : <strong style={{ color: T.text }}>{cur.courtier}</strong></span>}
                  {cur.adresse && <span style={{ fontSize: 12, color: T.textMuted }}>Fonds / projet : <strong style={{ color: T.text }}>{cur.adresse}</strong></span>}
                </>
              )}

              {/* Obligations */}
              {type === 'Obligations' && (
                <>
                  {cur.courtier && <span style={{ fontSize: 12, color: T.textMuted }}>Émetteur : <strong style={{ color: T.text }}>{cur.courtier}</strong></span>}
                  {cur.avType && <span style={{ fontSize: 12, color: T.textMuted }}>Type : <strong style={{ color: T.text }}>{cur.avType}</strong></span>}
                </>
              )}

              {/* PER */}
              {type === 'PER' && cur.courtier && (
                <span style={{ fontSize: 12, color: T.textMuted }}>Établissement : <strong style={{ color: T.text }}>{cur.courtier}</strong></span>
              )}

              {/* Assurance-vie fonds euros */}
              {type === 'Assurance-vie fonds euros' && cur.assureur && (
                <span style={{ fontSize: 12, color: T.textMuted }}>Assureur : <strong style={{ color: T.text }}>{cur.assureur}</strong></span>
              )}

              {/* Épargne salariale */}
              {type === 'Épargne salariale' && (
                <>
                  {cur.employeur && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_employer')} : <strong style={{ color: T.text }}>{cur.employeur}</strong></span>}
                  {cur.peType && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_plan')} : <strong style={{ color: T.text }}>{cur.peType}</strong></span>}
                  {cur.disponibiliteDate && <span style={{ fontSize: 12, color: T.textMuted }}>{t('inv_availability')} : <strong style={{ color: '#fb923c' }}>{fDate(cur.disponibiliteDate)}</strong></span>}
                </>
              )}

              {cur.notes && <span style={{ fontSize: 12, color: T.textMuted, width: '100%' }}>{t('inv_notes')} : <em style={{ color: T.text }}>{cur.notes}</em></span>}
            </div>
          </div>

          {/* Financement immo (crédit lié) */}
          {type === 'Immobilier' && cur.loanId && (() => {
            const linkedLoan = computedLoans.find(l => l.id === cur.loanId);
            if (!linkedLoan) return null;
            const monthly = (parseFloat(linkedLoan.monthlyPayment) || 0) + (parseFloat(linkedLoan.insuranceAmount) || 0);
            const netValue = lv - linkedLoan.computedRemaining;
            const loyer = parseFloat(cur.loyerMensuel) || 0;
            const charges = parseFloat(cur.chargesMensuelles) || 0;
            const effort = loyer - monthly - charges;
            return (
              <div style={{ ...S.card, borderLeft: '3px solid #f87171' }}>
                <h3 style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('inv_financing', linkedLoan.name)}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {[
                    { label: t('inv_gross_value'), val: fEur(lv), color: typeColor },
                    { label: t('inv_capital_remaining'), val: fEur(linkedLoan.computedRemaining), color: '#f87171' },
                    { label: t('inv_net_value'), val: fEur(netValue), color: netValue >= 0 ? '#4ade80' : '#f87171' },
                    { label: t('inv_monthly_payment'), val: fEur(monthly) + '/mois', color: '#fb923c' },
                    ...(loyer > 0 ? [{ label: t('inv_effort'), val: fEur(effort) + '/mois', color: effort >= 0 ? '#4ade80' : '#f87171', hint: t('inv_effort_hint') }] : []),
                  ].map(({ label, val, color, hint }) => (
                    <div key={label} style={{ background: T.bg2, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
                      {hint && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{hint}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Estimation immobilière */}
          {type === 'Immobilier' && (
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>🏠 Estimation du marché</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Ex: 12 rue de la Paix, Paris"
                  value={estForm.adresse}
                  onChange={e => setEstForm(f => ({ ...f, adresse: e.target.value }))}
                  style={{ ...S.inp }}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    placeholder="Surface en m²"
                    value={estForm.surface}
                    onChange={e => setEstForm(f => ({ ...f, surface: e.target.value }))}
                    style={{ ...S.inp, flex: '1 1 100px' }}
                  />
                  <select
                    value={estForm.type}
                    onChange={e => setEstForm(f => ({ ...f, type: e.target.value }))}
                    style={{ ...S.inp, flex: '1 1 120px' }}
                  >
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison</option>
                    <option value="immeuble">Immeuble</option>
                  </select>
                  <select
                    value={estForm.etat}
                    onChange={e => setEstForm(f => ({ ...f, etat: e.target.value }))}
                    style={{ ...S.inp, flex: '1 1 120px' }}
                  >
                    <option value="renover">À rénover</option>
                    <option value="bon">Bon état</option>
                    <option value="renove">Rénové</option>
                    <option value="neuf">Neuf</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[['parking', 'Parking'], ['jardin', 'Jardin'], ['cave', 'Cave'], ['ascenseur', 'Ascenseur']].map(([val, label]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.text, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={estForm.options.includes(val)}
                        onChange={e => setEstForm(f => ({ ...f, options: e.target.checked ? [...f.options, val] : f.options.filter(o => o !== val) }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleEstimer}
                  disabled={estimationLoading || !estForm.adresse || !estForm.surface}
                  style={{ ...S.btnG, opacity: (estimationLoading || !estForm.adresse || !estForm.surface) ? 0.6 : 1 }}
                >
                  {estimationLoading ? 'Estimation en cours…' : '🏠 Estimer'}
                </button>
              </div>

              {estimationError && (
                <div style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{estimationError}</div>
              )}

              {estimationImmo && (
                <div style={{ marginTop: 16, background: T.bg2, borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Fourchette basse</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: T.textMuted }}>{fEur(estimationImmo.fourchetteBasse, true)}</div>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, fontWeight: 600 }}>Estimation</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>{fEur(estimationImmo.estimation, true)}</div>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Fourchette haute</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: T.textMuted }}>{fEur(estimationImmo.fourchetteHaute, true)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: T.textMuted }}>Prix au m² du secteur : <strong style={{ color: T.text }}>{fEur(estimationImmo.prixM2)}/m²</strong></div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>Basé sur <strong style={{ color: T.text }}>{estimationImmo.nbTransactions} ventes récentes</strong> à {estimationImmo.commune}</div>
                    {estimationImmo.dateDerniereVente && (
                      <div style={{ fontSize: 12, color: T.textFaint }}>Dernière vente : {estimationImmo.dateDerniereVente}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Positions */}
          {showPositions && (
            <div style={{ ...S.card }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('inv_positions_title', (cur.positions || []).length)}</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => { setCashModal(cur); setCashOpMode('add'); setCashOpAmt(''); }} style={{ ...S.btnG, fontSize: 11, padding: '5px 12px', background: 'rgba(139,92,246,.15)', borderColor: 'rgba(139,92,246,.4)', color: '#a78bfa' }}>💰 Liquidités</button>
                  <button onClick={() => { setDivInvId(cur.id); setModal('div'); }} style={{ ...S.btnG, fontSize: 11, padding: '5px 12px', background: 'rgba(74,222,128,.1)', borderColor: 'rgba(74,222,128,.3)', color: '#4ade80' }}>{t('inv_add_dividend')}</button>
                  <button onClick={() => { setPosForm({ ...mkPos(), posType: invFormType(cur) }); setModal('drill'); }} style={{ ...S.btnG, fontSize: 11, padding: '5px 12px' }}>{t('inv_add_position')}</button>
                </div>
              </div>
              {(cur.positions || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: T.textFaint, fontSize: 13 }}>{t('inv_no_positions')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cur.positions || []).map(pos => {
                    const hasLiveFeed = ['stock', 'etf', 'crypto', 'commodity'].includes(pos.posType);
                    const livePrice = (hasLiveFeed ? (data.prices[pos.isin?.toUpperCase()] || data.prices[pos.ticker?.toUpperCase()] || null) : null) ?? pos.currentPrice;
                    const posVal = pos.shares * livePrice;
                    const posInv = pos.shares * pos.buyPrice;
                    const posPnl = posVal - posInv;
                    const posPct = posInv > 0 ? (posPnl / posInv) * 100 : 0;
                    const isCryptoType = type === 'Crypto';

                    // ── Logo ──────────────────────────────────────────────────
                    const posSymbol = (pos.ticker || pos.symbol || '').split('.')[0].toUpperCase();
                    const isPosCommod = type === 'Matières premières' || pos.posType === 'commodity';
                    const isPosRealt  = type === 'RealT';
                    const isPosScpi   = ['SCPI', 'OPCI', 'SCI'].includes(type) || pos.posType === 'scpi';
                    const isPosCrypto = isCryptoType || pos.posType === 'crypto';
                    let posLogoSrcs, posLogoLetter, posLogoColor;
                    if (isPosCommod) {
                      posLogoSrcs   = [];
                      posLogoLetter = getCommodityEmoji(pos.name || pos.ticker);
                      posLogoColor  = '#EAB308';
                    } else if (isPosRealt) {
                      posLogoSrcs   = [];
                      posLogoLetter = '🏘️';
                      posLogoColor  = '#EF4444';
                    } else if (isPosScpi) {
                      posLogoSrcs   = scpiLogoSources(pos.name || '');
                      posLogoLetter = '🏬';
                      posLogoColor  = '#D97706';
                    } else if (isPosCrypto) {
                      posLogoSrcs   = [...stockLogoSources(pos.ticker, null), `https://assets.parqet.com/logos/symbol/${posSymbol}?format=svg`];
                      posLogoLetter = posSymbol[0] || '?';
                      posLogoColor  = '#F59E0B';
                    } else {
                      posLogoSrcs   = stockLogoSources(pos.ticker || pos.symbol, null);
                      posLogoLetter = posSymbol[0] || '?';
                      posLogoColor  = '#60A5FA';
                    }

                    return (
                      <div key={pos.id} style={{ padding: '12px 14px', background: T.bg2, borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <AssetLogo sources={posLogoSrcs} letter={posLogoLetter} color={posLogoColor} size={32} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{pos.ticker}</span>
                                <span style={{ color: T.textMuted, fontSize: 12 }}>{pos.name}</span>
                                {hasLiveFeed && data.prices[pos.ticker] !== undefined && <span style={{ fontSize: 9, background: T.accent + '33', color: T.accent, padding: '1px 5px', borderRadius: 3 }}>{t('inv_live_ok')}</span>}
                                {pos.exDivDate && (() => {
                                  const dUntil = Math.round((new Date(pos.exDivDate) - new Date()) / 86400000);
                                  if (dUntil < -7 || dUntil > 30) return null;
                                  const [, exM, exD] = pos.exDivDate.split('-');
                                  const estAmt = pos.divRate && pos.shares ? parseFloat((parseFloat(pos.divRate) * pos.shares).toFixed(2)) : null;
                                  return (
                                    <span style={{ fontSize: 9, background: '#F59E0B22', color: '#F59E0B', padding: '1px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                                      📅 {dUntil <= 0 ? `ex-div ${exD}/${exM}` : `div dans ${dUntil}j`}{estAmt ? ` · ~${fEur(estAmt)}` : ''}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div style={{ fontSize: 11, color: T.textFaint }}>
                                {isCryptoType ? `Qté ${+parseFloat(pos.shares).toFixed(4)}` : `${+parseFloat(pos.shares).toFixed(4)} parts`} · {isCryptoType ? 'DCA' : 'PRU'} {fEur(pos.buyPrice)} · Actuel {fEur(livePrice)}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{fEur(posVal)}</div>
                            <div style={{ fontSize: 11, color: posPnl >= 0 ? '#4ade80' : '#f87171' }}>{posPnl >= 0 ? '+' : ''}{fEur(posPnl)} ({fPct(posPct)})</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button onClick={() => { setEditItem({ posId: pos.id }); setPosForm({ ...mkPos(), posType: invFormType(cur), ticker: pos.ticker || '', name: pos.name || '', shares: pos.shares, buyPrice: pos.buyPrice, currentPrice: pos.currentPrice, divYield: pos.divYield ?? '', isin: pos.isin || '', exchange: pos.exchange || '', currency: pos.currency || 'EUR', platform: pos.platform || '', notes: pos.notes || '', divRate: pos.divRate || '', exDivDate: pos.exDivDate || '', divFrequency: pos.divFrequency || '' }); setModal('drill'); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                          <button onClick={() => setConfirmDel({ msg: `Supprimer "${pos.name || pos.ticker}" de cette enveloppe ? Cette action est irréversible.`, fn: () => setInvestments(p => p.map(inv => inv.id !== cur.id ? inv : { ...inv, positions: inv.positions.filter(x => x.id !== pos.id) })) })} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Loyers RealT ─────────────────────────────────────────────────── */}
          {cur.type === 'RealT' && /^0x[0-9a-fA-F]{40}$/i.test(cur.platform || '') && (
            <div style={{ ...S.card }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Loyers reçus</h3>
                  {rentData?.allRents?.[0]?.date && (
                    <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                      Dernier loyer : {rentData.allRents[0].date}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {['3M', '6M', '12M', 'TOUT'].map(tf => (
                    <button key={tf} onClick={() => setRentTf(tf)} style={{ background: rentTf === tf ? 'rgba(74,222,128,.12)' : T.cardBg, border: `1px solid ${rentTf === tf ? '#4ade80' : T.cardBorder}`, color: rentTf === tf ? '#4ade80' : T.textMuted, borderRadius: 8, padding: '3px 9px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>{tf}</button>
                  ))}
                  <button
                    onClick={() => loadRents(cur, true)}
                    disabled={rentLoading}
                    style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, color: T.textMuted, borderRadius: 8, padding: '3px 9px', fontSize: 10, cursor: rentLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: rentLoading ? 0.5 : 1 }}
                  >⟳ Actualiser</button>
                </div>
              </div>
              {rentLoading && <div style={{ textAlign: 'center', padding: '14px 0', color: T.textMuted, fontSize: 12 }}>Chargement…</div>}
              {rentError && <div style={{ color: '#f87171', fontSize: 12 }}>{rentError}</div>}
              {!rentLoading && rentData && (() => {
                const now = Date.now();
                const days = rentTf === '3M' ? 90 : rentTf === '6M' ? 180 : rentTf === '12M' ? 365 : Infinity;
                const filtered = rentData.allRents.filter(r => (now - new Date(r.date).getTime()) / 86400000 <= days);
                const totalEUR = filtered.reduce((s, r) => s + r.amountEUR, 0);
                const totalUSD = filtered.reduce((s, r) => s + r.amountUSD, 0);
                const yieldPct = lv > 0 && rentData.last12MonthsEUR > 0
                  ? (rentData.last12MonthsEUR / lv) * 100
                  : null;
                return (
                  <>
                    <div className="g3" style={{ marginBottom: 14 }}>
                      {[
                        { label: 'Total EUR', value: fEur(totalEUR, true), icon: '💶' },
                        { label: 'Total USD', value: `$${totalUSD.toFixed(2)}`, icon: '💵' },
                        { label: yieldPct != null ? 'Rendement annualisé' : 'Versements', value: yieldPct != null ? `${yieldPct.toFixed(2)}%` : String(filtered.length), icon: yieldPct != null ? '📈' : '📅' },
                      ].map(k => <KPI key={k.label} T={T} label={k.label} value={k.value} icon={k.icon} />)}
                    </div>
                    {filtered.length === 0
                      ? <div style={{ textAlign: 'center', padding: '14px 0', color: T.textFaint, fontSize: 12 }}>Aucun loyer sur la période</div>
                      : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 240, overflowY: 'auto' }}>
                          {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: T.bg2, borderRadius: 7, fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: T.textFaint, fontSize: 11 }}>{r.date}</span>
                                <span style={{ color: T.textMuted, fontSize: 11 }}>${r.amountUSD.toFixed(2)} USDC</span>
                              </div>
                              <span style={{ fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>+{fEur(r.amountEUR)}</span>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </>
                );
              })()}
              {!rentLoading && !rentData && !rentError && (
                <div style={{ textAlign: 'center', padding: '14px 0', color: T.textFaint, fontSize: 12 }}>Aucun loyer trouvé</div>
              )}
            </div>
          )}

          {/* Loyers — section spécifique Immobilier */}
          {type === 'Immobilier' && (() => {
            const loyers = cur.loyers || [];
            const cutoff12m = Date.now() - 365 * 86400000;
            const total12m = loyers
              .filter(l => new Date(l.date).getTime() >= cutoff12m)
              .reduce((s, l) => s + (parseFloat(l.montant) || 0), 0);
            return (
              <div style={{ ...S.card }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Loyers perçus</h3>
                    {total12m > 0 && (
                      <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2 }}>
                        12 mois glissants : <strong>{fEur(total12m)}</strong>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setLoyerForm({ show: true, montant: String(parseFloat(cur.loyerMensuel) || ''), date: today(), compteId: '' })}
                    style={{ ...S.btnG, fontSize: 11, padding: '5px 12px' }}
                  >+ Loyer reçu</button>
                </div>

                {loyerForm.show && (
                  <div style={{ background: T.bg2, borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Montant (€)</div>
                        <input
                          type="number"
                          placeholder="Montant"
                          value={loyerForm.montant}
                          onChange={e => setLoyerForm(f => ({ ...f, montant: e.target.value }))}
                          style={{ ...S.inp }}
                        />
                      </div>
                      <div style={{ flex: '1 1 140px' }}>
                        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Date de réception</div>
                        <input
                          type="date"
                          value={loyerForm.date}
                          onChange={e => setLoyerForm(f => ({ ...f, date: e.target.value }))}
                          style={{ ...S.inp }}
                        />
                      </div>
                      <div style={{ flex: '1 1 160px' }}>
                        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Compte destination</div>
                        <select
                          value={loyerForm.compteId}
                          onChange={e => setLoyerForm(f => ({ ...f, compteId: e.target.value }))}
                          style={{ ...S.inp }}
                        >
                          <option value="">— Aucun —</option>
                          {computedSavings.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({fEur(c.balance)})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleSaveLoyer} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>Enregistrer</button>
                      <button onClick={() => setLoyerForm(f => ({ ...f, show: false }))} style={{ ...S.btnS, fontSize: 12, padding: '7px 14px' }}>Annuler</button>
                    </div>
                  </div>
                )}

                {loyers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: T.textFaint, fontSize: 13 }}>Aucun loyer enregistré</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {[...loyers].sort((a, b) => b.date.localeCompare(a.date)).map(l => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: T.bg2, borderRadius: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ color: T.textFaint }}>{fDate(l.date)}</span>
                          {l.compteNom && <span style={{ color: T.textMuted, fontSize: 11 }}>→ {l.compteNom}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: '#4ade80' }}>+{fEur(l.montant)}</span>
                          <button
                            onClick={() => setConfirmDel({ msg: `Supprimer ce loyer de ${fEur(l.montant)} ? Cette action est irréversible.`, fn: () => setInvestments(p => p.map(inv => inv.id !== cur.id ? inv : { ...inv, loyers: inv.loyers.filter(x => x.id !== l.id) })) })}
                            style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Dividendes — masqué pour RealT (loyers Blockscout) et Immobilier (loyers propres) */}
          {cur.type !== 'RealT' && cur.type !== 'Immobilier' && <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('inv_dividends')}</h3>
              <button onClick={() => { setDivInvId(cur.id); setModal('div'); }} style={{ ...S.btnS, fontSize: 11, padding: '5px 12px', color: '#4ade80', borderColor: 'rgba(74,222,128,.3)' }}>{t('inv_add_dividend')}</button>
            </div>
            {invDivs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: T.textFaint, fontSize: 13 }}>{t('inv_no_dividends')}</div>
            ) : (
              <>
                <div className="g3" style={{ marginBottom: 14 }}>
                  {[
                    { label: t('inv_total_year', cy), value: fEur(invDivs.filter(d => d.date.startsWith(String(cy))).reduce((s,d)=>s+d.amount,0), true), accent: '#4ade80', icon: '💸' },
                    { label: t('inv_payments'), value: invDivs.length, icon: '📅' },
                    { label: t('inv_total_received'), value: fEur(invDivTotal, true), icon: '⌀' },
                  ].map(kpi => <KPI key={kpi.label} T={T} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {[...invDivs].sort((a,b) => b.date.localeCompare(a.date)).map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: T.bg2, borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: T.textFaint }}>{fDate(d.date)}</span>
                        {d.note && <span style={{ color: T.textMuted, fontSize: 11 }}>{d.note}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#4ade80' }}>+{fEur(d.amount)}</span>
                        <span style={{ fontSize: 10, color: d.gross ? '#fb923c' : '#a78bfa', background: d.gross ? 'rgba(251,146,60,.12)' : 'rgba(167,139,250,.12)', padding: '1px 6px', borderRadius: 4 }}>{d.gross ? t('gross') : t('net')}</span>
                        <button onClick={() => setConfirmDel({ msg: `Supprimer ce dividende de ${fEur(d.amount)} ? Cette action est irréversible.`, fn: () => delDividend(cur.id, d.id) })} style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>}
        </div>
      );
    }

    // ── Vue liste (overview) ──────────────────────────────────────────────────
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {priceStatus === 'loading' && <span style={{ fontSize: 11, color: '#60a5fa' }}>{t('inv_live_updating')}</span>}
            {priceStatus === 'ok' && lastUpdated && (
              <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                {t('inv_live_ok')} · {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {priceStatus === 'error' && <span style={{ fontSize: 11, color: '#f87171' }}>{t('inv_live_error')}</span>}
            <button onClick={fetchPrices} style={{ ...S.btnS, fontSize: 12, padding: '4px 10px' }}>⟳</button>
          </div>
          <button data-tutorial="pat-add" onClick={() => { if (!isPro && investments.length >= 3) { alert('Limite de 3 enveloppes en version gratuite. Passez en Pro pour un accès illimité.'); return; } setModal('addInvestment'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Ajouter un investissement</button>
        </div>

        <div className="g4">
          <KPI T={T} label={t('inv_actifs_fin')} value={fEur(invTotal, true)} icon="🏛️" />
          <KPI T={T} label={t('inv_capital')} value={fEur(invInvested, true)} icon="💸" />
          <KPI T={T} label={t('inv_plus_values')} value={fEur(invTotal - invInvested, true)} accent={(invTotal - invInvested) >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
          <KPI T={T} label={t('inv_perf')} value={fPct(invInvested > 0 ? ((invTotal - invInvested) / invInvested) * 100 : 0)} accent={invTotal >= invInvested ? T.accent : '#f87171'} icon="⚡" />
        </div>

        {investments.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: T.textMuted }}>{t('inv_no_envelope')}</div>
            <div style={{ fontSize: 13 }}>{t('inv_no_envelope_hint')}</div>
          </div>
        ) : (
          <div className="g12">
            {/* Allocation pie par type */}
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>{t('inv_allocation')}</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={investments.map(inv => ({ name: inv.name, value: invLiveValue(inv), color: inv.color }))} cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={4} dataKey="value">
                    {investments.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => fEur(v)} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {investments.map((inv, i) => {
                  const type = inv.type || 'Autre';
                  const typeColor = PORTFOLIO_TYPE_COLOR[type] || inv.color;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: inv.color }} />
                        <span style={{ color: T.textMuted }}>{inv.name}</span>
                        <span style={{ fontSize: 9, background: typeColor + '22', color: typeColor, padding: '1px 6px', borderRadius: 10 }}>{PORTFOLIO_TYPE_ICON[type] || '📦'} {type}</span>
                      </div>
                      <span style={{ color: T.text, fontWeight: 600 }}>{invTotal > 0 ? ((invLiveValue(inv) / invTotal) * 100).toFixed(0) : 0}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Envelopes list */}
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>{t('inv_envelopes')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {investments.map(inv => {
                  const invCash = parseFloat(inv.cash) || 0;
                  const lv = invLiveValue(inv);
                  const li = invLiveInvested(inv);
                  const pnl = (lv - invCash) - li;
                  const pct = li > 0 ? (pnl / li) * 100 : 0;
                  const type = inv.type || 'Autre';
                  const typeColor = PORTFOLIO_TYPE_COLOR[type] || inv.color;
                  const typeIcon = PORTFOLIO_TYPE_ICON[type] || '📦';
                  const invDivTotal = (inv.dividends || []).reduce((s, d) => s + d.amount, 0);
                  return (
                    <div key={inv.id} style={{ padding: '12px 14px', background: T.bg2, borderRadius: 12, borderLeft: `3px solid ${inv.color}`, cursor: 'pointer', transition: 'opacity .15s' }}
                      onClick={() => setDrillInv(inv)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{inv.name}</span>
                            <span style={{ fontSize: 9, background: typeColor + '22', color: typeColor, padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>{typeIcon} {type}</span>
                            <span style={{ fontSize: 10, color: T.textMuted }}>↗</span>
                          </div>
                          <div style={{ fontSize: 11, color: T.textFaint }}>
                            {(inv.positions || []).length} position{(inv.positions || []).length !== 1 ? 's' : ''}
                            {invCash > 0 && <span style={{ color: '#4ade80', marginLeft: 6 }}>· 💶 {fEur(invCash)}</span>}
                            {invDivTotal > 0 && <span style={{ color: '#4ade80', marginLeft: 6 }}>· div. {fEur(invDivTotal, true)}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{fEur(lv)}</div>
                          <div style={{ fontSize: 11, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>{pnl >= 0 ? '+' : ''}{fEur(pnl)} ({fPct(pct)})</div>
                        </div>
                      </div>
                      <div style={{ background: T.cardBorder, borderRadius: 4, height: 3 }}>
                        <div style={{ width: `${invTotal > 0 ? (lv / invTotal) * 100 : 0}%`, height: '100%', background: inv.color, borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button onClick={e => { e.stopPropagation(); openEditPortfolio(inv); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDel({ msg: `Supprimer l'enveloppe "${inv.name}" ? Cette action est irréversible et supprimera tous les actifs associés.`, fn: () => delInv(inv.id) }); }} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dividendes globaux */}
        {allDividends.length > 0 && (
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('inv_div_global')}</h3>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{t('inv_div_all')}</p>
              </div>
            </div>
            <div className="g3" style={{ marginBottom: 16 }}>
              {[
                { label: t('inv_total_year', new Date().getFullYear()), value: fEur(divThisYear, true), accent: '#4ade80', icon: '💸' },
                { label: t('inv_nb_payments'), value: allDividends.length, icon: '📅' },
                { label: t('inv_avg_payment'), value: allDividends.length > 0 ? fEur(allDividends.reduce((s,d)=>s+d.amount,0)/allDividends.length) : '—', icon: '⌀' },
              ].map(kpi => <KPI key={kpi.label} T={T} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />)}
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={divByMonth} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? fEur(v, true) : ''} width={44} />
                <Tooltip formatter={v => [fEur(v), t('inv_dividends')]} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="Dividendes" fill="#4ade80" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Loyers globaux — toutes enveloppes Immobilier */}
        {(() => {
          const allLoyers = investments
            .filter(inv => inv.type === 'Immobilier')
            .flatMap(inv => (inv.loyers || []).map(l => ({ ...l, bienNom: inv.name })));
          if (!allLoyers.length) return null;

          const cutoff12m = Date.now() - 365 * 86400000;
          const total12m = allLoyers
            .filter(l => new Date(l.date).getTime() >= cutoff12m)
            .reduce((s, l) => s + (parseFloat(l.montant) || 0), 0);

          const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
          const now = new Date();
          const chartData = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const total = allLoyers
              .filter(l => l.date?.slice(0, 7) === key)
              .reduce((s, l) => s + (parseFloat(l.montant) || 0), 0);
            return { month: MONTHS_FR[d.getMonth()], Loyers: Math.round(total) };
          });

          return (
            <div style={{ ...S.card }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>🏠 Loyers perçus — toutes propriétés</h3>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>12 mois glissants</p>
              </div>
              <div className="g3" style={{ marginBottom: 16 }}>
                {[
                  { label: 'Total 12 mois', value: fEur(total12m, true), accent: '#4ade80', icon: '💶' },
                  { label: 'Versements', value: allLoyers.filter(l => new Date(l.date).getTime() >= cutoff12m).length, icon: '📅' },
                  { label: 'Moy. mensuelle', value: fEur(total12m / 12), icon: '⌀' },
                ].map(kpi => <KPI key={kpi.label} T={T} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />)}
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chartData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                  <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? fEur(v, true) : ''} width={44} />
                  <Tooltip formatter={v => [fEur(v), 'Loyers']} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="Loyers" fill="#8B5CF6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                {[...allLoyers].sort((a, b) => b.date.localeCompare(a.date)).map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: T.bg2, borderRadius: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: T.text }}>{l.bienNom}</span>
                      <span style={{ color: T.textFaint }}>{fDate(l.date)}</span>
                      {l.compteNom && <span style={{ color: T.textMuted, fontSize: 11 }}>→ {l.compteNom}</span>}
                    </div>
                    <span style={{ fontWeight: 700, color: '#4ade80' }}>+{fEur(l.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Épargne & Cash ─────────────────────────────────────────────────────────
  const renderCash = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setEditItem(null); data.setCashForm && data.setCashForm(data.mkCash()); setModal('cash'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>{t('cash_add')}</button>
      </div>
      <div className="g4">
        <KPI T={T} label={t('cash_total')} value={fEur(cashTotal, true)} accent="#34d399" icon="🏦" />
        <KPI T={T} label={t('cash_interests')} value={fEur(annualInterests, true)} accent="#4ade80" icon="💸" />
        <KPI T={T} label={t('cash_avg_rate')} value={avgRate.toFixed(2) + '%'} accent="#60a5fa" icon="%" />
        <KPI T={T} label={t('cash_nb_accounts')} value={computedSavings.length} icon="🗂️" />
      </div>
      {computedSavings.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏦</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t('cash_no_accounts')}</div>
          <div style={{ fontSize: 13 }}>{t('cash_add_hint')}</div>
        </div>
      ) : (
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {computedSavings.map(c => {
              const interests = c.computedBalance * (c.rate / 100);
              const color = CASH_TYPE_COLORS[c.type] || '#94a3b8';
              const hasDelta = c.computedBalance !== c.balance;
              const info = CASH_TYPE_INFO[c.type] || {};
              const cap = info.cap;
              const overCap = cap != null && c.computedBalance > cap;
              const remaining = cap != null ? cap - c.computedBalance : null;
              const capPct = cap != null && cap > 0 ? Math.min(100, (c.computedBalance / cap) * 100) : 0;
              return (
                <div key={c.id} style={{ padding: '14px 16px', background: T.bg2, borderRadius: 12, borderLeft: `3px solid ${overCap ? '#f87171' : color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</span>
                        <span style={{ fontSize: 10, background: color + '22', color, padding: '2px 7px', borderRadius: 20 }}>{c.type}</span>
                        {overCap && <span style={{ fontSize: 10, background: 'rgba(248,113,113,.15)', color: '#f87171', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>{t('cash_cap_exceeded')}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint }}>
                        {c.rate > 0 ? `${c.rate.toFixed(2)}% / an → ` : t('cash_non_rem')}
                        {c.rate > 0 && <span style={{ color: '#4ade80' }}>{fEur(interests)} / an</span>}
                        {hasDelta && <span style={{ color: T.textMuted, marginLeft: 6 }}>· {t('cash_initial_balance')} : {fEur(c.balance)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: overCap ? '#f87171' : T.text }}>{fEur(c.computedBalance)}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{cashTotal > 0 ? ((c.computedBalance / cashTotal) * 100).toFixed(1) : 0}%</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => openEditCash(c)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                        <button onClick={() => setConfirmDel({ msg: `Supprimer le compte "${c.name}" ? Cette action est irréversible.`, fn: () => delCash(c.id) })} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                      </div>
                    </div>
                  </div>
                  {cap != null && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted, marginBottom: 4 }}>
                        <span>{t('cash_cap')} : {fEur(cap)}</span>
                        <span style={{ color: overCap ? '#f87171' : remaining != null && remaining < cap * 0.1 ? '#fb923c' : '#4ade80' }}>
                          {overCap ? `${t('cash_exceeded')} ${fEur(c.computedBalance - cap)}` : `${t('cash_remaining')} : ${fEur(remaining)}`}
                        </span>
                      </div>
                      <div style={{ background: T.cardBorder, borderRadius: 4, height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${capPct}%`, height: '100%', background: overCap ? '#f87171' : capPct > 90 ? '#fb923c' : color, borderRadius: 4, transition: 'width .4s' }} />
                      </div>
                    </div>
                  )}
                  {cap == null && (
                    <div style={{ background: T.cardBorder, borderRadius: 4, height: 3, marginTop: 10 }}>
                      <div style={{ width: `${cashTotal > 0 ? (c.computedBalance / cashTotal) * 100 : 0}%`, height: '100%', background: color, borderRadius: 4 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── Matériel ───────────────────────────────────────────────────────────────
  const renderMateriel = () => {
    const catTotals = {};
    healthAssets.forEach(h => { catTotals[h.category] = (catTotals[h.category] || 0) + h.currentValue; });
    listings.forEach(l => { catTotals[l.category] = (catTotals[l.category] || 0) + (parseFloat(l.sellPrice) || parseFloat(l.buyPrice) || 0); });
    const pieData = Object.entries(catTotals).map(([name, value], i) => ({ name, value, color: LISTING_CAT_COLORS[name] || INV_COLORS[i % INV_COLORS.length] }));
    const daysOn = d => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    const totalItems = healthAssets.length + listings.length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Bénéfices réalisés — bandeau permanent */}
        {(soldProfit !== 0 || soldHistory.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{t('mat_gains_year', new Date().getFullYear())}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: soldProfitThisYear >= 0 ? '#4ade80' : '#f87171' }}>{soldProfitThisYear >= 0 ? '+' : ''}{fEur(soldProfitThisYear)}</div>
              <div style={{ fontSize: 11, color: '#4ade8099', marginTop: 2 }}>{soldHistory.filter(x => x.soldDate?.startsWith(String(new Date().getFullYear()))).length} vente{soldHistory.filter(x => x.soldDate?.startsWith(String(new Date().getFullYear()))).length !== 1 ? 's' : ''} cette année</div>
            </div>
            <div style={{ background: T.accent + '0f', border: `1px solid ${T.accent}26`, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{t('mat_gains_total')}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: soldProfit >= 0 ? T.accent : '#f87171' }}>{soldProfit >= 0 ? '+' : ''}{fEur(soldProfit)}</div>
              <div style={{ fontSize: 11, color: T.accent + '99', marginTop: 2 }}>{soldHistory.length} objet{soldHistory.length !== 1 ? 's' : ''} vendu{soldHistory.length !== 1 ? 's' : ''} au total</div>
            </div>
          </div>
        )}

        <div className="g4">
          <KPI T={T} label={t('mat_total_value')} value={fEur(healthTotal, true)} accent="#60a5fa" icon="🏠" />
          <KPI T={T} label={t('mat_acquisition_cost')} value={fEur(healthCost, true)} icon="💳" />
          <KPI T={T} label={t('mat_pnl')} value={fEur(healthTotal - healthCost, true)} accent={(healthTotal - healthCost) >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
          <KPI T={T} label="Nb d'actifs" value={`${totalItems} (${listings.length} en vente)`} icon="📦" />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { if (!isPro && healthAssets.length >= 5) { alert('Limite de 5 actifs matériels en version gratuite. Passez en Pro pour un accès illimité.'); return; } setEditItem(null); data.setHealthForm && data.setHealthForm(data.mkHealth()); setModal('health'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>{t('mat_add_asset')}</button>
          <button onClick={() => { setEditItem(null); data.setListingForm && data.setListingForm(data.mkListing()); setModal('listing'); }} style={{ ...S.btnS, fontSize: 12, padding: '7px 16px' }}>{t('mat_add_listing')}</button>
        </div>

        {(healthAssets.length > 0 || listings.length > 0) && pieData.length > 0 && (
          <div className="g12">
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>{t('mat_repartition')}</h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => fEur(v)} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                {pieData.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} />
                      <span style={{ color: T.textMuted }}>{c.name || '—'}</span>
                    </div>
                    <span style={{ color: T.text }}>{fEur(c.value, true)}</span>
                  </div>
                ))}
              </div>
            </div>
            {healthAssets.length > 0 && (
              <div style={{ ...S.card }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>{t('mat_assets')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {healthAssets.map(h => {
                    const pnl = h.currentValue - h.buyPrice;
                    const pct = h.buyPrice > 0 ? (pnl / h.buyPrice) * 100 : 0;
                    return (
                      <div key={h.id} style={{ padding: '12px 14px', background: T.bg2, borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{h.name}</div>
                            <div style={{ fontSize: 11, color: T.textFaint, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {h.category && <span>{h.category}</span>}
                              {h.condition && <span style={{ background: 'rgba(96,165,250,.1)', color: '#60a5fa', padding: '1px 6px', borderRadius: 4 }}>{h.condition}</span>}
                              {h.storageLocation && <span>📍 {h.storageLocation}</span>}
                              {h.notes && <span>{h.notes}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{fEur(h.currentValue)}</div>
                            <div style={{ fontSize: 11, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>{pnl >= 0 ? '+' : ''}{fEur(pnl)} ({fPct(pct)})</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditHealth(h)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 10 }}>✎</button>
                          <button onClick={() => setConfirmDel({ msg: `Supprimer "${h.name}" du patrimoine matériel ? Cette action est irréversible.`, fn: () => delHealth(h.id) })} style={{ ...S.btnD, padding: '3px 8px', fontSize: 10 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Articles en vente */}
        {listings.length > 0 && (
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('mat_for_sale', listings.length)}</h3>
              <span style={{ fontSize: 12, color: T.textMuted }}>{t('mat_expected_profit')} : <span style={{ color: listingsExpectedProfit >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{fEur(listingsExpectedProfit, true)}</span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {listings.map(l => {
                const profit = l.sellPrice - l.buyPrice - (l.fees || 0);
                const days = daysOn(l.listedDate);
                const catColor = LISTING_CAT_COLORS[l.category] || '#94a3b8';
                return (
                  <div key={l.id} style={{ padding: '12px 14px', background: T.bg2, borderRadius: 12, borderLeft: `3px solid ${catColor}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.name}</span>
                          {l.category && <span style={{ fontSize: 10, background: catColor + '22', color: catColor, padding: '2px 7px', borderRadius: 20 }}>{l.category}</span>}
                          {l.condition && <span style={{ fontSize: 10, background: 'rgba(96,165,250,.1)', color: '#60a5fa', padding: '2px 7px', borderRadius: 20 }}>{l.condition}</span>}
                          {l.platform && <span style={{ fontSize: 11, color: T.textMuted }}>🏷️ {l.platform}</span>}
                          <span style={{ fontSize: 10, color: days > 30 ? '#f87171' : T.textMuted }}>{days === 0 ? t('today_label') : t('days_online', days)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span>{t('mat_price_buy_label')} {fEur(l.buyPrice)} · {t('mat_price_sell_label')} {fEur(l.sellPrice)}{l.fees > 0 ? ` · ${t('mat_fees_label')} ${fEur(l.fees)}` : ''}</span>
                          {l.storageLocation && <span>📍 {l.storageLocation}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: profit >= 0 ? '#4ade80' : '#f87171' }}>{profit >= 0 ? '+' : ''}{fEur(profit)}</div>
                          <div style={{ fontSize: 10, color: T.textFaint }}>{t('mat_profit_label')}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <button onClick={() => openEditListing(l)} style={{ ...S.btnS, padding: '2px 7px', fontSize: 10 }}>✎</button>
                          <button onClick={() => setConfirmDel({ msg: `Supprimer l'annonce "${l.name}" ? Cette action est irréversible.`, fn: () => delListing(l.id) })} style={{ ...S.btnD, padding: '2px 7px', fontSize: 10 }}>✕</button>
                          <button onClick={() => markSold(l)} style={{ ...S.btnG, padding: '2px 7px', fontSize: 10 }}>{t('mat_sell_btn')}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Historique des ventes */}
        {soldHistory.length > 0 && (
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('mat_sold_items', soldHistory.length)}</h3>
              <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>+{fEur(soldProfit, true)} {t('mat_realized')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {soldHistory.map(x => {
                const catColor = LISTING_CAT_COLORS[x.category] || '#94a3b8';
                return (
                  <div key={x.id} style={{ padding: '10px 12px', background: T.bg2, borderRadius: 10, borderLeft: `3px solid ${x.profit >= 0 ? '#4ade80' : '#f87171'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{x.name}</span>
                          {x.category && <span style={{ fontSize: 9, background: catColor + '22', color: catColor, padding: '1px 6px', borderRadius: 10 }}>{x.category}</span>}
                          {x.condition && <span style={{ fontSize: 9, background: 'rgba(96,165,250,.1)', color: '#60a5fa', padding: '1px 6px', borderRadius: 10 }}>{x.condition}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span>{t('mat_bought_label')} {fEur(x.buyPrice)}</span>
                          <span>{t('mat_sold_price_label')} {fEur(x.sellPrice)}</span>
                          {x.fees > 0 && <span>{t('mat_fees_label')} {fEur(x.fees)}</span>}
                          {x.platform && <span>{t('mat_via')} {x.platform}</span>}
                          <span style={{ color: T.textMuted }}>{fDate(x.soldDate)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: x.profit >= 0 ? '#4ade80' : '#f87171' }}>{x.profit >= 0 ? '+' : ''}{fEur(x.profit)}</div>
                        </div>
                        <button onClick={() => setConfirmDel({ msg: `Supprimer "${x.name}" de l'historique des ventes ? Cette action est irréversible.`, fn: () => setSoldHistory(p => p.filter(s => s.id !== x.id)) })} style={{ ...S.btnD, padding: '2px 6px', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Crédits immobiliers ────────────────────────────────────────────────────
  const renderLoans = () => {
    const monthlyLoanTotal = computedLoans.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0) + (parseFloat(l.insuranceAmount) || 0), 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, flex: 1 }}>
            <KPI T={T} label={t('loan_capital_remaining')} value={fEur(totalLoanDebt, true)} accent="#f87171" icon="🏠" />
            <KPI T={T} label={t('loan_monthly')} value={fEur(monthlyLoanTotal) + '/mois'} accent="#fb923c" icon="📅" />
            <KPI T={T} label={t('loan_nb')} value={computedLoans.length} icon="📋" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { setEditItem(null); data.setLoanForm && data.setLoanForm(data.mkLoan()); setModal('loan'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>{t('loan_add')}</button>
        </div>
        {computedLoans.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏠</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t('loan_no_loans')}</div>
            <div style={{ fontSize: 13 }}>{t('loan_no_loans_hint')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {computedLoans.map(l => {
              const monthly = (parseFloat(l.monthlyPayment) || 0) + (parseFloat(l.insuranceAmount) || 0);
              const months = mLeft(l.endDate);
              const costRemaining = Math.max(0, months * monthly - l.computedRemaining);
              const repaidPct = l.capitalBorrowed > 0 ? Math.min(100, ((l.capitalBorrowed - l.computedRemaining) / l.capitalBorrowed) * 100) : 0;
              return (
                <div key={l.id} style={{ ...S.card, borderLeft: '4px solid #f87171' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>{l.lender}{l.rate ? ` · ${parseFloat(l.rate).toFixed(2)}%` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditLoan(l)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                      <button onClick={() => setConfirmDel({ msg: `Supprimer le crédit "${l.name}" ? Cette action est irréversible.`, fn: () => delLoan(l.id) })} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: t('loan_capital_remaining'), val: fEur(l.computedRemaining), color: '#f87171' },
                      { label: t('inv_monthly_payment'), val: fEur(monthly) + '/mois', color: '#fb923c' },
                      { label: t('loan_remaining_duration'), val: months > 0 ? `${months} mois` : '—', color: T.textMuted },
                      { label: t('loan_remaining_cost'), val: fEur(costRemaining), color: '#f87171' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: T.bg2, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {l.insuranceAmount > 0 && (
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 10 }}>
                      {t('loan_insurance')} {l.insuranceOrganisme ? `(${l.insuranceOrganisme})` : ''} : {fEur(parseFloat(l.insuranceAmount))}/mois
                      {l.insuranceRate ? ` · ${parseFloat(l.insuranceRate).toFixed(3)}%` : ''}
                    </div>
                  )}
                  {l.capitalBorrowed > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                        <span>{t('loan_repaid')}</span>
                        <span style={{ fontWeight: 600, color: '#4ade80' }}>{repaidPct.toFixed(0)}%</span>
                      </div>
                      <div style={{ background: T.cardBorder, borderRadius: 4, height: 5 }}>
                        <div style={{ width: `${repaidPct}%`, height: '100%', background: '#4ade80', borderRadius: 4, transition: 'width .4s' }} />
                      </div>
                    </>
                  )}

                  {/* ── Simulateur remboursement anticipé ── */}
                  {(() => {
                    const extra = loanSim[l.id] ?? 0;
                    const capital = l.computedRemaining;
                    const rate = parseFloat(l.rate) || 0;
                    const basePayment = monthly;
                    const newPayment = basePayment + extra;
                    const baseMonths = isFinite(months) && months > 0 ? months : calcMonthsToPayoff(capital, rate, basePayment);
                    const newMonths = extra > 0 ? calcMonthsToPayoff(capital, rate, newPayment) : baseMonths;
                    const monthsSaved = isFinite(baseMonths) && isFinite(newMonths) ? Math.max(0, baseMonths - newMonths) : 0;
                    const interestSaved = isFinite(baseMonths) && isFinite(newMonths)
                      ? Math.max(0, baseMonths * basePayment - newMonths * newPayment)
                      : 0;

                    const maxPts = Math.min(isFinite(baseMonths) ? baseMonths : 360, 360);
                    const step = Math.max(1, Math.ceil(maxPts / 10));
                    const chartData = [];
                    for (let m = 0; m <= maxPts; m += step) {
                      chartData.push({
                        label: m === 0 ? 'Auj.' : `M${m}`,
                        Base: Math.round(balAtMonth(capital, rate, basePayment, m)),
                        Anticipé: extra > 0 ? Math.round(balAtMonth(capital, rate, newPayment, m)) : undefined,
                      });
                    }

                    return (
                      <div style={{ marginTop: 16, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ fontSize: 12, color: T.textMuted }}>{t('loan_simulator')}</h4>
                          <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>+{extra} €/mois</span>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <input type="range" min={0} max={1000} step={25} value={extra}
                            onChange={e => setLoanSim(p => ({ ...p, [l.id]: +e.target.value }))} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginTop: 2 }}>
                            <span>0 €</span><span>+1 000 €/mois</span>
                          </div>
                        </div>
                        {extra > 0 && isFinite(newMonths) && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                              {[
                                { label: t('loan_months_saved'), val: `−${monthsSaved} mois`, color: '#4ade80' },
                                { label: t('loan_interest_saved'), val: fEur(interestSaved, true), color: '#4ade80' },
                                { label: t('loan_new_end'), val: addMonths(new Date(), newMonths), color: '#60a5fa' },
                              ].map(({ label, val, color }) => (
                                <div key={label} style={{ background: T.bg2, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                                  <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color }}>{val}</div>
                                </div>
                              ))}
                            </div>
                            <ResponsiveContainer width="100%" height={120}>
                              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                                <XAxis dataKey="label" tick={{ fill: T.textMuted, fontSize: 8 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: T.textMuted, fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={46} />
                                <Tooltip formatter={(v,n) => [fEur(v), n]} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 10 }} />
                                <Line type="monotone" dataKey="Base" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Base" />
                                <Line type="monotone" dataKey="Anticipé" stroke="#4ade80" strokeWidth={2} dot={false} name="Anticipé" />
                              </LineChart>
                            </ResponsiveContainer>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>{t('nav_patrimoine')}</h1>
            <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>
              {linkedLoanDebt > 0 ? (
                <>
                  {t('gross')} : <strong style={{ color: T.accent }}>{fEur(patrimoine)}</strong>
                  {' · '}{t('net')} : <strong style={{ color: '#4ade80' }}>{fEur(patrimoine - linkedLoanDebt)}</strong>
                  <span style={{ fontSize: 11, color: T.textFaint }}> {t('pat_after_immo')}</span>
                </>
              ) : (
                <>{t('pat_total_label')} : <strong style={{ color: T.accent }}>{fEur(patrimoine)}</strong></>
              )}
            </p>
          </div>
        </div>
        <SubNav />
        {section === 'invest' && renderInvest()}
        {section === 'cash' && renderCash()}
        {section === 'materiel' && renderMateriel()}
        {section === 'loans' && renderLoans()}
      </div>
      {cashModal && (() => {
        const cur = investments.find(i => i.id === cashModal.id) || cashModal;
        const curCash = parseFloat(cur.cash) || 0;
        const amt = parseFloat(cashOpAmt) || 0;
        const isWithdraw = cashOpMode === 'remove';
        const overWithdraw = isWithdraw && amt > curCash;
        const canConfirm = amt > 0 && !overWithdraw;
        const confirm = () => {
          const delta = isWithdraw ? -amt : amt;
          setInvestments(p => p.map(inv =>
            inv.id === cur.id
              ? { ...inv, cash: parseFloat(((parseFloat(inv.cash) || 0) + delta).toFixed(2)) }
              : inv
          ));
          setTransactions(p => [{
            id: uid(), date: today(), recurrent: false, accountId: '', destAccountId: '', loanId: '',
            type: isWithdraw ? 'expense' : 'income',
            category: isWithdraw ? 'Retrait' : 'Dépôt',
            label: isWithdraw ? `Retrait depuis ${cur.name}` : `Dépôt sur ${cur.name}`,
            amount: isWithdraw ? -amt : amt,
          }, ...p]);
          setCashModal(null); setCashOpAmt('');
        };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: T.bg3, border: '1px solid rgba(96,165,250,.25)', borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,.65)', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(96,165,250,.08)', borderBottom: '1px solid rgba(96,165,250,.2)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>💰 Gérer les liquidités</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{cur.name}</div>
                </div>
                <button onClick={() => { setCashModal(null); setCashOpAmt(''); }} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: T.textMuted, padding: '5px 12px', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Solde actuel</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{fEur(curCash)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ id: 'add', label: '+ Ajouter' }, { id: 'remove', label: '− Retirer' }].map(m => (
                    <button key={m.id} onClick={() => { setCashOpMode(m.id); setCashOpAmt(''); }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1px solid ${cashOpMode === m.id ? '#60a5fa' : 'rgba(255,255,255,.08)'}`, background: cashOpMode === m.id ? 'rgba(96,165,250,.12)' : T.bg2, color: cashOpMode === m.id ? '#60a5fa' : T.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Montant (€)</label>
                  <input
                    autoFocus type="number" min="0" step="0.01" placeholder="0.00"
                    value={cashOpAmt}
                    onChange={e => setCashOpAmt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && canConfirm && confirm()}
                    style={{ width: '100%', boxSizing: 'border-box', background: T.bg2, border: `1px solid ${overWithdraw ? '#f87171' : 'rgba(255,255,255,.1)'}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, fontFamily: 'inherit', outline: 'none' }}
                  />
                  {overWithdraw && <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>Montant supérieur au solde ({fEur(curCash)})</div>}
                </div>
                {amt > 0 && !overWithdraw && (
                  <div style={{ background: isWithdraw ? 'rgba(248,113,113,.08)' : 'rgba(74,222,128,.08)', border: `1px solid ${isWithdraw ? 'rgba(248,113,113,.2)' : 'rgba(74,222,128,.2)'}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: isWithdraw ? '#f87171' : '#4ade80' }}>
                    Nouveau solde : {fEur(curCash + (isWithdraw ? -amt : amt))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={confirm} disabled={!canConfirm} style={{ flex: 1, background: canConfirm ? 'linear-gradient(135deg,#60a5fa,#3b82f6)' : '#4b5563', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: canConfirm ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                    Confirmer
                  </button>
                  <button onClick={() => { setCashModal(null); setCashOpAmt(''); }} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: T.textMuted, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: T.bg3, border: '1px solid rgba(248,113,113,.35)', borderRadius: 16, padding: '26px 28px', maxWidth: 400, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10, textAlign: 'center' }}>Confirmer la suppression</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 22, textAlign: 'center', lineHeight: 1.55 }}>{confirmDel.msg}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDel(null)} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: T.textMuted, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={() => { confirmDel.fn(); setConfirmDel(null); }} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10, color: '#fff', padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
