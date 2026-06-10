import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { KPI, TT, makeS, fEur, fPct, fDate, INV_COLORS, CASH_TYPE_COLORS, LISTING_CAT_COLORS, LISTING_PLATFORM_ICONS } from '../utils/constants';

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

export default function Patrimoine({ T, data }) {
  const S = makeS(T);
  const [section, setSection] = useState('invest');

  const {
    investments, invTotal, invInvested, invLiveValue, priceStatus, lastUpdated, fetchPrices,
    savings, cashTotal, annualInterests, avgRate,
    healthAssets, healthTotal, healthCost,
    listings, soldHistory, setSoldHistory, listingsExpectedProfit, soldProfit,
    loans, totalLoanDebt, monthlyDebtPayments,
    patrimoine, projYears, setProjYears, projRate, setProjRate, projMonthly, setProjMonthly, projData,
    setModal, setEditItem, setDrillInv,
    openEditInv, delInv, openEditCash, delCash, openEditHealth, delHealth,
    openEditListing, delListing, markSold,
    openEditLoan, delLoan,
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
  const renderInvest = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {priceStatus === 'loading' && <span style={{ fontSize: 11, color: '#60a5fa' }}>⟳ Actualisation…</span>}
            {priceStatus === 'ok' && lastUpdated && (
              <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                LIVE · {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {priceStatus === 'error' && <span style={{ fontSize: 11, color: '#f87171' }}>⚠ Serveur prix déconnecté</span>}
            <button onClick={fetchPrices} style={{ ...S.btnS, fontSize: 12, padding: '4px 10px' }}>⟳</button>
          </div>
          <button onClick={() => { setEditItem(null); data.setInvForm && data.setInvForm(data.mkInv()); setModal('inv'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Actif</button>
        </div>

        <div className="g4">
          <KPI T={T} label="Actifs financiers" value={fEur(invTotal, true)} icon="🏛️" />
          <KPI T={T} label="Capital investi" value={fEur(invInvested, true)} icon="💸" />
          <KPI T={T} label="Plus-values" value={fEur(invTotal - invInvested, true)} accent={(invTotal - invInvested) >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
          <KPI T={T} label="Performance" value={fPct(invInvested > 0 ? ((invTotal - invInvested) / invInvested) * 100 : 0)} accent={invTotal >= invInvested ? '#10b981' : '#f87171'} icon="⚡" />
        </div>

        <div className="g12">
          {/* Pie */}
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Allocation</h3>
            {investments.length === 0 ? (
              <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Aucun actif</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={investments.map(inv => ({ ...inv, value: invLiveValue(inv) }))} cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={4} dataKey="value">
                      {investments.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fEur(v)} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                  {investments.map((inv, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: inv.color }} />
                        <span style={{ color: T.textMuted }}>{inv.category}</span>
                      </div>
                      <span style={{ color: T.text }}>{invTotal > 0 ? ((invLiveValue(inv) / invTotal) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* List */}
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Détail des actifs</h3>
            {investments.length === 0 ? (
              <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📈</div>
                <div>Ajoutez votre premier actif financier</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {investments.map(inv => {
                  const lv = invLiveValue(inv);
                  const pnl = lv - inv.invested;
                  const pct = inv.invested > 0 ? (pnl / inv.invested) * 100 : 0;
                  return (
                    <div key={inv.id} style={{ padding: '12px 14px', background: T.bg2, borderRadius: 12, borderLeft: `3px solid ${inv.color}`, cursor: 'pointer', transition: 'opacity .15s' }}
                      onClick={() => { setDrillInv(inv); setModal('drill'); }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{inv.name} <span style={{ fontSize: 10, color: T.textMuted }}>↗</span></div>
                          <div style={{ fontSize: 11, color: T.textFaint }}>{inv.category} · {inv.positions?.length || 0} position{(inv.positions?.length || 0) !== 1 ? 's' : ''}</div>
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
                        <button onClick={e => { e.stopPropagation(); openEditInv(inv); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                        <button onClick={e => { e.stopPropagation(); delInv(inv.id); }} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
        <KPI T={T} label="Nb de comptes" value={savings.length} icon="🗂️" />
      </div>
      {savings.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏦</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun compte</div>
          <div style={{ fontSize: 13 }}>Ajoutez votre Livret A, LDD, compte courant…</div>
        </div>
      ) : (
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savings.map(c => {
              const interests = c.balance * (c.rate / 100);
              const color = CASH_TYPE_COLORS[c.type] || '#94a3b8';
              return (
                <div key={c.id} style={{ padding: '14px 16px', background: T.bg2, borderRadius: 12, borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</span>
                        <span style={{ fontSize: 10, background: color + '22', color, padding: '2px 7px', borderRadius: 20 }}>{c.type}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint }}>
                        {c.rate > 0 ? `${c.rate.toFixed(2)}% / an → ` : 'Non rémunéré'}
                        {c.rate > 0 && <span style={{ color: '#4ade80' }}>{fEur(interests)} / an</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{fEur(c.balance)}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{cashTotal > 0 ? ((c.balance / cashTotal) * 100).toFixed(1) : 0}%</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => openEditCash(c)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                        <button onClick={() => delCash(c.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: T.cardBorder, borderRadius: 4, height: 3, marginTop: 10 }}>
                    <div style={{ width: `${cashTotal > 0 ? (c.balance / cashTotal) * 100 : 0}%`, height: '100%', background: color, borderRadius: 4 }} />
                  </div>
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
    const pieData = Object.entries(catTotals).map(([name, value], i) => ({ name, value, color: INV_COLORS[i % INV_COLORS.length] }));
    const daysOn = d => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="g4" style={{ flex: 1 }}>
            <KPI T={T} label="Valeur actuelle" value={fEur(healthTotal, true)} accent="#60a5fa" icon="🏠" />
            <KPI T={T} label="Coût d'acquisition" value={fEur(healthCost, true)} icon="💳" />
            <KPI T={T} label="Plus/Moins-value" value={fEur(healthTotal - healthCost, true)} accent={(healthTotal - healthCost) >= 0 ? '#4ade80' : '#f87171'} icon="📊" />
            <KPI T={T} label="Nb d'actifs" value={healthAssets.length} icon="📦" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setEditItem(null); data.setHealthForm && data.setHealthForm(data.mkHealth()); setModal('health'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Actif matériel</button>
          <button onClick={() => { setEditItem(null); data.setListingForm && data.setListingForm(data.mkListing()); setModal('listing'); }} style={{ ...S.btnS, fontSize: 12, padding: '7px 16px' }}>+ Article en vente</button>
        </div>

        {healthAssets.length > 0 && (
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
                      <span style={{ color: T.textMuted }}>{c.name}</span>
                    </div>
                    <span style={{ color: T.text }}>{fEur(c.value, true)}</span>
                  </div>
                ))}
              </div>
            </div>
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
                          <div style={{ fontSize: 11, color: T.textFaint }}>{h.category}{h.notes ? ` · ${h.notes}` : ''}</div>
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
          </div>
        )}

        {/* Listings */}
        {(listings.length > 0 || soldHistory.length > 0) && (
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Ventes en cours ({listings.length})</h3>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: T.textMuted }}>
                <span>Bénéfice espéré : <span style={{ color: listingsExpectedProfit >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{fEur(listingsExpectedProfit, true)}</span></span>
              </div>
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
                          <span style={{ fontSize: 10, background: catColor + '22', color: catColor, padding: '2px 7px', borderRadius: 20 }}>{l.category}</span>
                          <span style={{ fontSize: 11, color: T.textMuted }}>{LISTING_PLATFORM_ICONS[l.platform]} {l.platform}</span>
                          <span style={{ fontSize: 10, color: days > 30 ? '#f87171' : T.textMuted }}>{days === 0 ? "Aujourd'hui" : `${days}j`}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.textFaint }}>Achat {fEur(l.buyPrice)} · Vente {fEur(l.sellPrice)}{l.fees > 0 ? ` · Frais ${fEur(l.fees)}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: profit >= 0 ? '#4ade80' : '#f87171' }}>{profit >= 0 ? '+' : ''}{fEur(profit)}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <button onClick={() => openEditListing(l)} style={{ ...S.btnS, padding: '2px 7px', fontSize: 10 }}>✎</button>
                          <button onClick={() => delListing(l.id)} style={{ ...S.btnD, padding: '2px 7px', fontSize: 10 }}>✕</button>
                          <button onClick={() => markSold(l)} style={{ ...S.btnG, padding: '2px 7px', fontSize: 10 }}>✓</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {soldHistory.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
                  Historique ({soldHistory.length}) · Profit réalisé : <span style={{ color: soldProfit >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{fEur(soldProfit, true)}</span>
                </div>
                {soldHistory.slice(0, 5).map(x => (
                  <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                    <span style={{ color: T.textMuted }}>{x.name} · {fDate(x.soldDate)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: x.profit >= 0 ? '#4ade80' : '#f87171' }}>{x.profit >= 0 ? '+' : ''}{fEur(x.profit)}</span>
                      <button onClick={() => setSoldHistory(p => p.filter(s => s.id !== x.id))} style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Crédits immobiliers ────────────────────────────────────────────────────
  const renderLoans = () => {
    const monthlyLoanTotal = loans.reduce((s, l) => s + (parseFloat(l.monthlyPayment) || 0) + (parseFloat(l.insuranceAmount) || 0), 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, flex: 1 }}>
            <KPI T={T} label="Capital restant dû" value={fEur(totalLoanDebt, true)} accent="#f87171" icon="🏠" />
            <KPI T={T} label="Mensualités totales" value={fEur(monthlyLoanTotal) + '/mois'} accent="#fb923c" icon="📅" />
            <KPI T={T} label="Nb de crédits" value={loans.length} icon="📋" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { setEditItem(null); data.setLoanForm && data.setLoanForm(data.mkLoan()); setModal('loan'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>+ Crédit immo</button>
        </div>
        {loans.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: 50, color: T.textFaint }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏠</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Aucun crédit immobilier</div>
            <div style={{ fontSize: 13 }}>Ajoutez votre prêt immobilier pour suivre le capital restant et les mensualités</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loans.map(l => {
              const monthly = (parseFloat(l.monthlyPayment) || 0) + (parseFloat(l.insuranceAmount) || 0);
              const months = mLeft(l.endDate);
              const costRemaining = Math.max(0, months * monthly - (parseFloat(l.capitalRemaining) || 0));
              const repaidPct = l.capitalBorrowed > 0 ? Math.min(100, ((l.capitalBorrowed - parseFloat(l.capitalRemaining)) / l.capitalBorrowed) * 100) : 0;
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
                      { label: 'Capital restant dû', val: fEur(parseFloat(l.capitalRemaining) || 0), color: '#f87171' },
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
