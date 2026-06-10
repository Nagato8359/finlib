import { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { KPI, TT, makeS, fEur, fPct, fDate, INV_COLORS, CASH_TYPE_COLORS, CASH_TYPE_INFO, LISTING_CAT_COLORS, PORTFOLIO_TYPE_ICON, PORTFOLIO_TYPE_COLOR, getInvFormType } from '../utils/constants';

const SECTIONS = [
  { id: 'invest', label: '◈ Investissements' },
  { id: 'cash', label: '🏦 Épargne & Cash' },
  { id: 'materiel', label: '📦 Matériel' },
  { id: 'loans', label: '🏠 Crédits immo' },
  { id: 'projection', label: '📊 Projection' },
];

const mLeft = endDate => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, months);
};

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

export default function Patrimoine({ T, data }) {
  const S = makeS(T);
  const [section, setSection] = useState('invest');
  const [loanSim, setLoanSim] = useState({});

  const {
    investments, invTotal, invInvested, invLiveValue, invLiveInvested, priceStatus, lastUpdated, fetchPrices,
    computedSavings, cashTotal, annualInterests, avgRate,
    healthAssets, healthTotal, healthCost,
    listings, soldHistory, setSoldHistory, listingsExpectedProfit, soldProfit, soldProfitThisYear,
    computedLoans, totalLoanDebt,
    patrimoine, projYears, setProjYears, projRate, setProjRate, projMonthly, setProjMonthly, projData,
    setModal, setEditItem, setDrillInv, drillInv, setDivInvId,
    openEditPortfolio, delInv, openEditCash, delCash, openEditHealth, delHealth,
    openEditListing, delListing, markSold,
    openEditLoan, delLoan,
    allDividends, divThisYear, divByMonth, delDividend,
    setPosForm, mkPos, setInvestments,
  } = data;

  const SubNav = () => (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
      {SECTIONS.map(s => (
        <button key={s.id} onClick={() => setSection(s.id)}
          style={{ background: section === s.id ? 'rgba(16,185,129,.12)' : T.cardBg, border: `1px solid ${section === s.id ? '#10b981' : T.cardBorder}`, color: section === s.id ? '#10b981' : T.textMuted, borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: section === s.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}>
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
      const lv = invLiveValue(cur);
      const li = invLiveInvested(cur);
      const pnl = lv - li;
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
            <button onClick={() => setDrillInv(null)} style={{ ...S.btnS, fontSize: 12, padding: '5px 12px' }}>← Retour</button>
            <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{cur.name}</span>
            <span style={{ fontSize: 11, background: typeColor + '22', color: typeColor, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{typeIcon} {type}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => openEditPortfolio(cur)} style={{ ...S.btnS, fontSize: 11, padding: '4px 10px' }}>✎ Modifier</button>
              <button onClick={() => setDrillInv(null) || delInv(cur.id)} style={{ ...S.btnD, fontSize: 11, padding: '4px 10px' }}>✕</button>
            </div>
          </div>

          {/* KPIs */}
          <div className="g4">
            <KPI T={T} label="Valeur actuelle" value={fEur(lv, true)} accent={typeColor} icon={typeIcon} />
            <KPI T={T} label="Capital investi" value={fEur(li, true)} icon="💸" />
            <KPI T={T} label="Plus-value" value={fEur(pnl, true)} accent={pnl >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
            <KPI T={T} label="Performance" value={fPct(pct)} accent={pnl >= 0 ? '#10b981' : '#f87171'} icon="⚡" />
          </div>

          {/* Infos type-spécifiques */}
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 12, color: T.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>Détails</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(type === 'PEA' || type === 'CTO') && cur.courtier && (
                <span style={{ fontSize: 12, color: T.textMuted }}>Courtier : <strong style={{ color: T.text }}>{cur.courtier}</strong></span>
              )}
              {cur.openDate && <span style={{ fontSize: 12, color: T.textMuted }}>Ouverture : <strong style={{ color: T.text }}>{fDate(cur.openDate)}</strong></span>}
              {type === 'PEA' && cur.openDate && (() => {
                const fiveYears = new Date(new Date(cur.openDate).getFullYear() + 5, new Date(cur.openDate).getMonth(), new Date(cur.openDate).getDate());
                const passed = now >= fiveYears;
                return <span style={{ fontSize: 12, color: passed ? '#4ade80' : '#fb923c' }}>{passed ? '✅ Fiscalité PEA active' : `⏳ Avantage fiscal: ${fiveYears.toLocaleDateString('fr-FR')}`}</span>;
              })()}
              {type === 'Assurance-vie' && (
                <>
                  {cur.assureur && <span style={{ fontSize: 12, color: T.textMuted }}>Assureur : <strong style={{ color: T.text }}>{cur.assureur}</strong></span>}
                  {cur.avType && <span style={{ fontSize: 12, color: T.textMuted }}>Type : <strong style={{ color: T.text }}>{cur.avType}</strong></span>}
                  {cur.openDate && (() => {
                    const eight = new Date(new Date(cur.openDate).getFullYear() + 8, new Date(cur.openDate).getMonth(), new Date(cur.openDate).getDate());
                    const passed = now >= eight;
                    return <span style={{ fontSize: 12, color: passed ? '#4ade80' : '#fb923c' }}>{passed ? '✅ Fiscalité 8 ans active' : `⏳ Fiscalité avantageuse: ${eight.toLocaleDateString('fr-FR')}`}</span>;
                  })()}
                </>
              )}
              {type === 'Crypto' && (
                <>
                  {cur.platform && <span style={{ fontSize: 12, color: T.textMuted }}>Plateforme : <strong style={{ color: T.text }}>{cur.platform}</strong></span>}
                  {cur.walletType && <span style={{ fontSize: 12, color: T.textMuted }}>Type : <strong style={{ color: T.text }}>{cur.walletType}</strong></span>}
                </>
              )}
              {type === 'Immobilier' && (
                <>
                  {cur.immoBien && <span style={{ fontSize: 12, color: T.textMuted }}>Type : <strong style={{ color: T.text }}>{cur.immoBien}</strong></span>}
                  {cur.adresse && <span style={{ fontSize: 12, color: T.textMuted }}>Adresse : <strong style={{ color: T.text }}>{cur.adresse}</strong></span>}
                  {cur.loyerMensuel > 0 && <span style={{ fontSize: 12, color: T.textMuted }}>Loyer : <strong style={{ color: '#4ade80' }}>{fEur(cur.loyerMensuel)}/mois</strong></span>}
                  {cur.chargesMensuelles > 0 && <span style={{ fontSize: 12, color: T.textMuted }}>Charges : <strong style={{ color: '#f87171' }}>{fEur(cur.chargesMensuelles)}/mois</strong></span>}
                  {cur.loyerMensuel > 0 && lv > 0 && (
                    <span style={{ fontSize: 12, color: T.textMuted }}>Rendement brut : <strong style={{ color: typeColor }}>{((cur.loyerMensuel * 12 / lv) * 100).toFixed(2)}%</strong></span>
                  )}
                  {cur.loyerMensuel > 0 && cur.chargesMensuelles > 0 && (
                    <span style={{ fontSize: 12, color: T.textMuted }}>Cashflow net : <strong style={{ color: (cur.loyerMensuel - cur.chargesMensuelles) >= 0 ? '#4ade80' : '#f87171' }}>{fEur(cur.loyerMensuel - cur.chargesMensuelles)}/mois</strong></span>
                  )}
                </>
              )}
              {type === 'Épargne salariale' && (
                <>
                  {cur.employeur && <span style={{ fontSize: 12, color: T.textMuted }}>Employeur : <strong style={{ color: T.text }}>{cur.employeur}</strong></span>}
                  {cur.peType && <span style={{ fontSize: 12, color: T.textMuted }}>Plan : <strong style={{ color: T.text }}>{cur.peType}</strong></span>}
                  {cur.disponibiliteDate && <span style={{ fontSize: 12, color: T.textMuted }}>Disponibilité : <strong style={{ color: '#fb923c' }}>{fDate(cur.disponibiliteDate)}</strong></span>}
                </>
              )}
              {cur.notes && <span style={{ fontSize: 12, color: T.textMuted, width: '100%' }}>Notes : <em style={{ color: T.text }}>{cur.notes}</em></span>}
            </div>
          </div>

          {/* Positions */}
          {showPositions && (
            <div style={{ ...S.card }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Positions ({(cur.positions || []).length})</h3>
                <button onClick={() => { setPosForm({ ...mkPos(), posType: invFormType(cur) }); setModal('drill'); }} style={{ ...S.btnG, fontSize: 11, padding: '5px 12px' }}>+ Position</button>
              </div>
              {(cur.positions || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: T.textFaint, fontSize: 13 }}>Aucune position — cliquez "+ Position" pour ajouter</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cur.positions || []).map(pos => {
                    const livePrice = data.prices[pos.ticker] ?? pos.currentPrice;
                    const posVal = pos.shares * livePrice;
                    const posInv = pos.shares * pos.buyPrice;
                    const posPnl = posVal - posInv;
                    const posPct = posInv > 0 ? (posPnl / posInv) * 100 : 0;
                    const isCryptoType = type === 'Crypto';
                    return (
                      <div key={pos.id} style={{ padding: '12px 14px', background: T.bg2, borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{pos.ticker}</span>
                              <span style={{ color: T.textMuted, fontSize: 12 }}>{pos.name}</span>
                              {data.prices[pos.ticker] !== undefined && <span style={{ fontSize: 9, background: 'rgba(16,185,129,.2)', color: '#10b981', padding: '1px 5px', borderRadius: 3 }}>LIVE</span>}
                            </div>
                            <div style={{ fontSize: 11, color: T.textFaint }}>
                              {isCryptoType ? `Qté ${pos.shares}` : `${pos.shares} parts`} · {isCryptoType ? 'DCA' : 'PRU'} {fEur(pos.buyPrice)} · Actuel {fEur(livePrice)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{fEur(posVal)}</div>
                            <div style={{ fontSize: 11, color: posPnl >= 0 ? '#4ade80' : '#f87171' }}>{posPnl >= 0 ? '+' : ''}{fEur(posPnl)} ({fPct(posPct)})</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button onClick={() => { setEditItem({ posId: pos.id }); setPosForm({ ...mkPos(), posType: invFormType(cur), ticker: pos.ticker || '', name: pos.name || '', shares: pos.shares, buyPrice: pos.buyPrice, currentPrice: pos.currentPrice, divYield: pos.divYield ?? '', isin: pos.isin || '', exchange: pos.exchange || '', currency: pos.currency || 'EUR', platform: pos.platform || '', notes: pos.notes || '' }); setModal('drill'); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                          <button onClick={() => setInvestments(p => p.map(inv => inv.id !== cur.id ? inv : { ...inv, positions: inv.positions.filter(x => x.id !== pos.id) }))} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Dividendes — scoped à cette enveloppe */}
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Dividendes</h3>
              <button onClick={() => { setDivInvId(cur.id); setModal('div'); }} style={{ ...S.btnS, fontSize: 11, padding: '5px 12px', color: '#4ade80', borderColor: 'rgba(74,222,128,.3)' }}>+ Dividende</button>
            </div>
            {invDivs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: T.textFaint, fontSize: 13 }}>Aucun dividende enregistré</div>
            ) : (
              <>
                <div className="g3" style={{ marginBottom: 14 }}>
                  {[
                    { label: `Total ${cy}`, value: fEur(invDivs.filter(d => d.date.startsWith(String(cy))).reduce((s,d)=>s+d.amount,0), true), accent: '#4ade80', icon: '💸' },
                    { label: 'Versements', value: invDivs.length, icon: '📅' },
                    { label: 'Total reçu', value: fEur(invDivTotal, true), icon: '⌀' },
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
                        <span style={{ fontSize: 10, color: d.gross ? '#fb923c' : '#a78bfa', background: d.gross ? 'rgba(251,146,60,.12)' : 'rgba(167,139,250,.12)', padding: '1px 6px', borderRadius: 4 }}>{d.gross ? 'brut' : 'net'}</span>
                        <button onClick={() => delDividend(cur.id, d.id)} style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    // ── Vue liste (overview) ──────────────────────────────────────────────────
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {priceStatus === 'loading' && <span style={{ fontSize: 11, color: '#60a5fa' }}>⟳ Actualisation…</span>}
            {priceStatus === 'ok' && lastUpdated && (
              <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                LIVE · {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {priceStatus === 'error' && <span style={{ fontSize: 11, color: '#f87171' }}>⚠ Serveur prix déconnecté</span>}
            <button onClick={fetchPrices} style={{ ...S.btnS, fontSize: 12, padding: '4px 10px' }}>⟳</button>
          </div>
          <button onClick={() => { setEditItem(null); data.setPortfolioForm && data.setPortfolioForm(data.mkPortfolio()); setModal('portfolio'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Enveloppe</button>
        </div>

        <div className="g4">
          <KPI T={T} label="Actifs financiers" value={fEur(invTotal, true)} icon="🏛️" />
          <KPI T={T} label="Capital investi" value={fEur(invInvested, true)} icon="💸" />
          <KPI T={T} label="Plus-values" value={fEur(invTotal - invInvested, true)} accent={(invTotal - invInvested) >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
          <KPI T={T} label="Performance" value={fPct(invInvested > 0 ? ((invTotal - invInvested) / invInvested) * 100 : 0)} accent={invTotal >= invInvested ? '#10b981' : '#f87171'} icon="⚡" />
        </div>

        {investments.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: T.textMuted }}>Aucune enveloppe</div>
            <div style={{ fontSize: 13 }}>Ajoutez votre PEA, CTO, assurance-vie, crypto ou bien immobilier</div>
          </div>
        ) : (
          <div className="g12">
            {/* Allocation pie par type */}
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Allocation</h3>
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
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Enveloppes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {investments.map(inv => {
                  const lv = invLiveValue(inv);
                  const li = invLiveInvested(inv);
                  const pnl = lv - li;
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
                        <button onClick={e => { e.stopPropagation(); delInv(inv.id); }} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                        <button onClick={e => { e.stopPropagation(); setDivInvId(inv.id); setModal('div'); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10, color: '#4ade80', borderColor: 'rgba(74,222,128,.3)' }}>+ Dividende</button>
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
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Dividendes — vue globale</h3>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Tous versements, toutes enveloppes</p>
              </div>
            </div>
            <div className="g3" style={{ marginBottom: 16 }}>
              {[
                { label: `Total ${new Date().getFullYear()}`, value: fEur(divThisYear, true), accent: '#4ade80', icon: '💸' },
                { label: 'Nb de versements', value: allDividends.length, icon: '📅' },
                { label: 'Moy. par versement', value: allDividends.length > 0 ? fEur(allDividends.reduce((s,d)=>s+d.amount,0)/allDividends.length) : '—', icon: '⌀' },
              ].map(kpi => <KPI key={kpi.label} T={T} label={kpi.label} value={kpi.value} accent={kpi.accent} icon={kpi.icon} />)}
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={divByMonth} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? fEur(v, true) : ''} width={44} />
                <Tooltip formatter={v => [fEur(v), 'Dividendes']} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="Dividendes" fill="#4ade80" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  // ── Épargne & Cash ─────────────────────────────────────────────────────────
  const renderCash = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setEditItem(null); data.setCashForm && data.setCashForm(data.mkCash()); setModal('cash'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Compte</button>
      </div>
      <div className="g4">
        <KPI T={T} label="Total épargne & cash" value={fEur(cashTotal, true)} accent="#34d399" icon="🏦" />
        <KPI T={T} label="Intérêts annuels" value={fEur(annualInterests, true)} accent="#4ade80" icon="💸" />
        <KPI T={T} label="Taux moyen" value={avgRate.toFixed(2) + '%'} accent="#60a5fa" icon="%" />
        <KPI T={T} label="Nb de comptes" value={computedSavings.length} icon="🗂️" />
      </div>
      {computedSavings.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏦</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun compte</div>
          <div style={{ fontSize: 13 }}>Ajoutez votre Livret A, LDD, compte courant…</div>
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
                        {overCap && <span style={{ fontSize: 10, background: 'rgba(248,113,113,.15)', color: '#f87171', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>⚠ Plafond dépassé</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint }}>
                        {c.rate > 0 ? `${c.rate.toFixed(2)}% / an → ` : 'Non rémunéré'}
                        {c.rate > 0 && <span style={{ color: '#4ade80' }}>{fEur(interests)} / an</span>}
                        {hasDelta && <span style={{ color: T.textMuted, marginLeft: 6 }}>· Solde initial : {fEur(c.balance)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: overCap ? '#f87171' : T.text }}>{fEur(c.computedBalance)}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{cashTotal > 0 ? ((c.computedBalance / cashTotal) * 100).toFixed(1) : 0}%</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => openEditCash(c)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                        <button onClick={() => delCash(c.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                      </div>
                    </div>
                  </div>
                  {cap != null && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted, marginBottom: 4 }}>
                        <span>Plafond : {fEur(cap)}</span>
                        <span style={{ color: overCap ? '#f87171' : remaining != null && remaining < cap * 0.1 ? '#fb923c' : '#4ade80' }}>
                          {overCap ? `Dépassé de ${fEur(c.computedBalance - cap)}` : `Reste : ${fEur(remaining)}`}
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
              <div style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Bénéfices réalisés — {new Date().getFullYear()}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: soldProfitThisYear >= 0 ? '#4ade80' : '#f87171' }}>{soldProfitThisYear >= 0 ? '+' : ''}{fEur(soldProfitThisYear)}</div>
              <div style={{ fontSize: 11, color: '#4ade8099', marginTop: 2 }}>{soldHistory.filter(x => x.soldDate?.startsWith(String(new Date().getFullYear()))).length} vente{soldHistory.filter(x => x.soldDate?.startsWith(String(new Date().getFullYear()))).length !== 1 ? 's' : ''} cette année</div>
            </div>
            <div style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#10b981', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Bénéfices réalisés — Total</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: soldProfit >= 0 ? '#10b981' : '#f87171' }}>{soldProfit >= 0 ? '+' : ''}{fEur(soldProfit)}</div>
              <div style={{ fontSize: 11, color: '#10b98199', marginTop: 2 }}>{soldHistory.length} objet{soldHistory.length !== 1 ? 's' : ''} vendu{soldHistory.length !== 1 ? 's' : ''} au total</div>
            </div>
          </div>
        )}

        <div className="g4">
          <KPI T={T} label="Valeur totale" value={fEur(healthTotal, true)} accent="#60a5fa" icon="🏠" />
          <KPI T={T} label="Coût d'acquisition" value={fEur(healthCost, true)} icon="💳" />
          <KPI T={T} label="Plus/Moins-value" value={fEur(healthTotal - healthCost, true)} accent={(healthTotal - healthCost) >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
          <KPI T={T} label="Nb d'actifs" value={`${totalItems} (${listings.length} en vente)`} icon="📦" />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setEditItem(null); data.setHealthForm && data.setHealthForm(data.mkHealth()); setModal('health'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Actif matériel</button>
          <button onClick={() => { setEditItem(null); data.setListingForm && data.setListingForm(data.mkListing()); setModal('listing'); }} style={{ ...S.btnS, fontSize: 12, padding: '7px 16px' }}>+ Article en vente</button>
        </div>

        {(healthAssets.length > 0 || listings.length > 0) && pieData.length > 0 && (
          <div className="g12">
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Répartition</h3>
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
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Actifs matériels</h3>
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
                          <button onClick={() => delHealth(h.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 10 }}>✕</button>
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
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Articles en vente ({listings.length})</h3>
              <span style={{ fontSize: 12, color: T.textMuted }}>Bénéfice espéré : <span style={{ color: listingsExpectedProfit >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{fEur(listingsExpectedProfit, true)}</span></span>
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
                          <span style={{ fontSize: 10, color: days > 30 ? '#f87171' : T.textMuted }}>{days === 0 ? "Aujourd'hui" : `${days}j`}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span>Achat {fEur(l.buyPrice)} · Vente {fEur(l.sellPrice)}{l.fees > 0 ? ` · Frais ${fEur(l.fees)}` : ''}</span>
                          {l.storageLocation && <span>📍 {l.storageLocation}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: profit >= 0 ? '#4ade80' : '#f87171' }}>{profit >= 0 ? '+' : ''}{fEur(profit)}</div>
                          <div style={{ fontSize: 10, color: T.textFaint }}>bénéfice espéré</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <button onClick={() => openEditListing(l)} style={{ ...S.btnS, padding: '2px 7px', fontSize: 10 }}>✎</button>
                          <button onClick={() => delListing(l.id)} style={{ ...S.btnD, padding: '2px 7px', fontSize: 10 }}>✕</button>
                          <button onClick={() => markSold(l)} style={{ ...S.btnG, padding: '2px 7px', fontSize: 10 }}>✓ Vendu</button>
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
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Objets vendus ({soldHistory.length})</h3>
              <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>+{fEur(soldProfit, true)} réalisé</span>
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
                          <span>Acheté {fEur(x.buyPrice)}</span>
                          <span>Vendu {fEur(x.sellPrice)}</span>
                          {x.fees > 0 && <span>Frais {fEur(x.fees)}</span>}
                          {x.platform && <span>via {x.platform}</span>}
                          <span style={{ color: T.textMuted }}>{fDate(x.soldDate)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: x.profit >= 0 ? '#4ade80' : '#f87171' }}>{x.profit >= 0 ? '+' : ''}{fEur(x.profit)}</div>
                        </div>
                        <button onClick={() => setSoldHistory(p => p.filter(s => s.id !== x.id))} style={{ ...S.btnD, padding: '2px 6px', fontSize: 10 }}>✕</button>
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
            <KPI T={T} label="Capital restant dû" value={fEur(totalLoanDebt, true)} accent="#f87171" icon="🏠" />
            <KPI T={T} label="Mensualités totales" value={fEur(monthlyLoanTotal) + '/mois'} accent="#fb923c" icon="📅" />
            <KPI T={T} label="Nb de crédits" value={computedLoans.length} icon="📋" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { setEditItem(null); data.setLoanForm && data.setLoanForm(data.mkLoan()); setModal('loan'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Crédit immo</button>
        </div>
        {computedLoans.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏠</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun crédit immobilier</div>
            <div style={{ fontSize: 13 }}>Ajoutez votre prêt immobilier pour suivre le capital restant et les mensualités</div>
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
                      <button onClick={() => delLoan(l.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Capital restant dû', val: fEur(l.computedRemaining), color: '#f87171' },
                      { label: 'Mensualité totale', val: fEur(monthly) + '/mois', color: '#fb923c' },
                      { label: 'Durée restante', val: months > 0 ? `${months} mois` : '—', color: T.textMuted },
                      { label: 'Coût restant du crédit', val: fEur(costRemaining), color: '#f87171' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: T.bg2, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {l.insuranceAmount > 0 && (
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 10 }}>
                      Assurance {l.insuranceOrganisme ? `(${l.insuranceOrganisme})` : ''} : {fEur(parseFloat(l.insuranceAmount))}/mois
                      {l.insuranceRate ? ` · ${parseFloat(l.insuranceRate).toFixed(3)}%` : ''}
                    </div>
                  )}
                  {l.capitalBorrowed > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                        <span>Remboursé</span>
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
                          <h4 style={{ fontSize: 12, color: T.textMuted }}>Simulateur remboursement anticipé</h4>
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
                                { label: 'Mois gagnés', val: `−${monthsSaved} mois`, color: '#4ade80' },
                                { label: 'Intérêts économisés', val: fEur(interestSaved, true), color: '#4ade80' },
                                { label: 'Nouvelle fin', val: addMonths(new Date(), newMonths), color: '#60a5fa' },
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

  // ── Projection ─────────────────────────────────────────────────────────────
  const renderProjection = () => {
    const fin = projData[projData.length - 1] || { Projection: patrimoine, Base: patrimoine };
    const interests = fin.Projection - fin.Base;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Simulateur d'intérêts composés</h3>
          <div className="g3w">
            {[
              { label: 'Durée', val: projYears, set: setProjYears, min: 1, max: 40, unit: ' ans', step: 1 },
              { label: 'Rendement annuel', val: projRate, set: setProjRate, min: 1, max: 20, unit: '%', step: 0.5 },
              { label: 'Versement mensuel', val: projMonthly, set: setProjMonthly, min: 0, max: 5000, unit: ' €/mois', step: 50 },
            ].map(({ label, val, set, min, max, unit, step }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                    {typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(1) : val}{unit}
                  </span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(+e.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginTop: 2 }}>
                  <span>{min}{unit.includes('%') ? '%' : ''}</span><span>{max}{unit.includes('%') ? '%' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="g4">
          <KPI T={T} label="Capital de départ" value={fEur(patrimoine, true)} icon="💰" />
          <KPI T={T} label={`Dans ${projYears} ans`} value={fEur(fin.Projection, true)} accent="#10b981" icon="🚀" />
          <KPI T={T} label="Versements totaux" value={fEur(projMonthly * 12 * projYears, true)} icon="📅" />
          <KPI T={T} label="Intérêts générés" value={fEur(interests, true)} accent="#4ade80" icon="✨" />
        </div>

        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Évolution du patrimoine</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={projData}>
              <defs>
                <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1} /><stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
              <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={55} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="Base" name="Sans rendement" stroke="#60a5fa" fill="url(#bG)" strokeWidth={1.5} strokeDasharray="4 3" />
              <Area type="monotone" dataKey="Projection" name="Avec rendement" stroke="#10b981" fill="url(#pG)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Jalons clés</h3>
          <div className="g4">
            {[1, 2, 5, 10, 20, 30].filter(y => y <= projYears && projData[y]).map(y => (
              <div key={y} style={{ padding: 14, background: T.bg2, borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Dans {y} an{y > 1 ? 's' : ''}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>{fEur(projData[y].Projection, true)}</div>
                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>×{(projData[y].Projection / Math.max(1, patrimoine)).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>Patrimoine</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Total : <strong style={{ color: '#10b981' }}>{fEur(patrimoine)}</strong></p>
        </div>
      </div>
      <SubNav />
      {section === 'invest' && renderInvest()}
      {section === 'cash' && renderCash()}
      {section === 'materiel' && renderMateriel()}
      {section === 'loans' && renderLoans()}
      {section === 'projection' && renderProjection()}
    </div>
  );
}
