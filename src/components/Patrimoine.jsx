import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { KPI, TT, makeS, fEur, fPct, fDate, INV_COLORS, CASH_TYPE_COLORS, CASH_TYPE_INFO, LISTING_CAT_COLORS, PORTFOLIO_TYPE_ICON, PORTFOLIO_TYPE_COLOR, getInvFormType } from '../utils/constants';
import { useTranslation } from '../hooks/useTranslation';

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
  const { t } = useTranslation();
  const [section, setSection] = useState('invest');
  const [loanSim, setLoanSim] = useState({});
  const [rentData, setRentData]       = useState(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [rentError, setRentError]     = useState('');
  const [rentTf, setRentTf]           = useState('12M');

  const SECTIONS = [
    { id: 'invest', label: t('pat_invest') },
    { id: 'cash', label: t('pat_cash') },
    { id: 'materiel', label: t('pat_materiel') },
    { id: 'loans', label: t('pat_loans') },
    { id: 'projection', label: t('pat_projection') },
  ];

  const {
    investments, invTotal, invInvested, invLiveValue, invLiveInvested, priceStatus, lastUpdated, fetchPrices,
    computedSavings, cashTotal, annualInterests, avgRate,
    healthAssets, healthTotal, healthCost,
    listings, soldHistory, setSoldHistory, listingsExpectedProfit, soldProfit, soldProfitThisYear,
    computedLoans, totalLoanDebt, linkedLoanDebt,
    patrimoine, projYears, setProjYears, projRate, setProjRate, projMonthly, setProjMonthly, projData,
    setModal, setEditItem, setDrillInv, drillInv, setDivInvId,
    openEditPortfolio, delInv, openEditCash, delCash, openEditHealth, delHealth,
    openEditListing, delListing, markSold,
    openEditLoan, delLoan,
    allDividends, divThisYear, divByMonth, delDividend,
    setPosForm, mkPos, setInvestments,
  } = data;

  const loadRents = useCallback((inv, forceRefresh = false) => {
    if (!inv || inv.type !== 'RealT' || !/^0x[0-9a-fA-F]{40}$/i.test(inv.platform || '')) return;
    setRentLoading(true); setRentData(null); setRentError('');
    const url = `/api/realt-rents?address=${inv.platform}${forceRefresh ? '&refresh=true' : ''}`;
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => openEditPortfolio(cur)} style={{ ...S.btnS, fontSize: 11, padding: '4px 10px' }}>{t('inv_edit')}</button>
              <button onClick={() => setDrillInv(null) || delInv(cur.id)} style={{ ...S.btnD, fontSize: 11, padding: '4px 10px' }}>✕</button>
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

          {/* Positions */}
          {showPositions && (
            <div style={{ ...S.card }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('inv_positions_title', (cur.positions || []).length)}</h3>
                <button onClick={() => { setPosForm({ ...mkPos(), posType: invFormType(cur) }); setModal('drill'); }} style={{ ...S.btnG, fontSize: 11, padding: '5px 12px' }}>{t('inv_add_position')}</button>
              </div>
              {(cur.positions || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: T.textFaint, fontSize: 13 }}>{t('inv_no_positions')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cur.positions || []).map(pos => {
                    const hasLiveFeed = ['stock', 'etf', 'crypto', 'commodity'].includes(pos.posType);
                    const livePrice = (hasLiveFeed ? (data.prices[pos.ticker] ?? null) : null) ?? pos.currentPrice;
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
                              {hasLiveFeed && data.prices[pos.ticker] !== undefined && <span style={{ fontSize: 9, background: T.accent + '33', color: T.accent, padding: '1px 5px', borderRadius: 3 }}>{t('inv_live_ok')}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: T.textFaint }}>
                              {isCryptoType ? `Qté ${+parseFloat(pos.shares).toFixed(4)}` : `${+parseFloat(pos.shares).toFixed(4)} parts`} · {isCryptoType ? 'DCA' : 'PRU'} {fEur(pos.buyPrice)} · Actuel {fEur(livePrice)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{fEur(posVal)}</div>
                            <div style={{ fontSize: 11, color: posPnl >= 0 ? '#4ade80' : '#f87171' }}>{posPnl >= 0 ? '+' : ''}{fEur(posPnl)} ({fPct(posPct)})</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button onClick={() => { setEditItem({ posId: pos.id }); setPosForm({ ...mkPos(), posType: invFormType(cur), ticker: pos.ticker || '', name: pos.name || '', shares: pos.shares, buyPrice: pos.buyPrice, currentPrice: pos.currentPrice, divYield: pos.divYield ?? '', isin: pos.isin || '', exchange: pos.exchange || '', currency: pos.currency || 'EUR', platform: pos.platform || '', notes: pos.notes || '', divRate: pos.divRate || '', exDivDate: pos.exDivDate || '', divFrequency: pos.divFrequency || '' }); setModal('drill'); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                          <button onClick={() => setInvestments(p => p.map(inv => inv.id !== cur.id ? inv : { ...inv, positions: inv.positions.filter(x => x.id !== pos.id) }))} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
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

          {/* Dividendes — scoped à cette enveloppe (masqué pour RealT : loyers via Blockscout) */}
          {cur.type !== 'RealT' && <div style={{ ...S.card }}>
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
                        <button onClick={() => delDividend(cur.id, d.id)} style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}>✕</button>
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
          <button onClick={() => setModal('addInvestment')} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Ajouter un investissement</button>
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
                        <button onClick={e => { e.stopPropagation(); delInv(inv.id); }} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                        <button onClick={e => { e.stopPropagation(); setDivInvId(inv.id); setModal('div'); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10, color: '#4ade80', borderColor: 'rgba(74,222,128,.3)' }}>{t('inv_add_dividend')}</button>
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
                        <button onClick={() => delCash(c.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
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
          <button onClick={() => { setEditItem(null); data.setHealthForm && data.setHealthForm(data.mkHealth()); setModal('health'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>{t('mat_add_asset')}</button>
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
                          <button onClick={() => delListing(l.id)} style={{ ...S.btnD, padding: '2px 7px', fontSize: 10 }}>✕</button>
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
                      <button onClick={() => delLoan(l.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
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

  // ── Projection ─────────────────────────────────────────────────────────────
  const renderProjection = () => {
    const fin = projData[projData.length - 1] || { Projection: patrimoine, Base: patrimoine };
    const interests = fin.Projection - fin.Base;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>{t('proj_title')}</h3>
          <div className="g3w">
            {[
              { label: t('proj_duration'), val: projYears, set: setProjYears, min: 1, max: 40, unit: ` ${t('proj_years')}`, step: 1 },
              { label: t('proj_rate'), val: projRate, set: setProjRate, min: 1, max: 20, unit: '%', step: 0.5 },
              { label: t('proj_monthly_contrib'), val: projMonthly, set: setProjMonthly, min: 0, max: 5000, unit: ' €/mois', step: 50 },
            ].map(({ label, val, set, min, max, unit, step }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>
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
          <KPI T={T} label={t('proj_start')} value={fEur(patrimoine, true)} icon="💰" />
          <KPI T={T} label={t('proj_in_n_years', projYears)} value={fEur(fin.Projection, true)} accent={T.accent} icon="🚀" />
          <KPI T={T} label={t('proj_total_payments')} value={fEur(projMonthly * 12 * projYears, true)} icon="📅" />
          <KPI T={T} label={t('proj_interests')} value={fEur(interests, true)} accent="#4ade80" icon="✨" />
        </div>

        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>{t('proj_evolution')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={projData}>
              <defs>
                <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.2} /><stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1} /><stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
              <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fEur(v, true)} width={55} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="Base" name={t('proj_no_return')} stroke="#60a5fa" fill="url(#bG)" strokeWidth={1.5} strokeDasharray="4 3" />
              <Area type="monotone" dataKey="Projection" name={t('proj_with_return')} stroke={T.accent} fill="url(#pG)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>{t('proj_milestones')}</h3>
          <div className="g4">
            {[1, 2, 5, 10, 20, 30].filter(y => y <= projYears && projData[y]).map(y => (
              <div key={y} style={{ padding: 14, background: T.bg2, borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>{t('proj_in')} {y} {t('proj_years')}{y > 1 ? '' : ''}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>{fEur(projData[y].Projection, true)}</div>
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
      {section === 'projection' && renderProjection()}
    </div>
  );
}
