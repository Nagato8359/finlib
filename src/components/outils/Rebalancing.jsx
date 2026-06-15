import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { makeS, fEur } from '../../utils/constants';

const isCrypto     = (inv) => inv.type?.toLowerCase().includes('crypto');
const isActions    = (inv) => ['pea','cto','compte-titres','assurance-vie','épargne salariale']
  .some(t => inv.type?.toLowerCase().includes(t));
const isPER        = (inv) => ['per','assurance-vie fonds'].some(t => inv.type?.toLowerCase().includes(t));
const isImmoFrac   = (inv) => ['realt','première brique','bricks','tantiem','crowdfunding immo']
  .some(t => inv.type?.toLowerCase().includes(t));
const isSCPI       = (inv) => ['scpi','opci','sci'].some(t => inv.type?.toLowerCase().includes(t));
const isImmoPhys   = (inv) => {
  const t = inv.type?.toLowerCase() || '';
  return t.includes('immobilier') && !t.includes('crowdfunding');
};
const isMatPrem    = (inv) => inv.type?.toLowerCase().includes('matière') || inv.type?.toLowerCase().includes('commodit');
const isAlternatif = (inv) => ['private equity','obligation','art','forêt','vigne','crowdfunding entreprise','autre']
  .some(t => inv.type?.toLowerCase().includes(t));

const CATS = [
  { key: 'actions',     label: 'Actions / ETF',         icon: '📈', color: '#10B981', match: (inv) => isActions(inv) || isPER(inv) },
  { key: 'crypto',      label: 'Crypto',                 icon: '₿',  color: '#F59E0B', match: isCrypto },
  { key: 'immo-frac',   label: 'Immo. fractionné',      icon: '🏘️', color: '#EF4444', match: isImmoFrac },
  { key: 'scpi',        label: 'SCPI / OPCI',            icon: '🏢', color: '#D97706', match: isSCPI },
  { key: 'immo-phys',   label: 'Immobilier physique',    icon: '🏠', color: '#8B5CF6', match: isImmoPhys },
  { key: 'matieres',    label: 'Matières premières',     icon: '🥇', color: '#EAB308', match: isMatPrem },
  { key: 'alternatifs', label: 'Alternatifs',            icon: '💼', color: '#7C3AED', match: isAlternatif },
  { key: 'cash',        label: 'Épargne & Cash',         icon: '🏦', color: '#34D399', match: null },
  { key: 'materiel',    label: 'Patrimoine matériel',    icon: '📦', color: '#60A5FA', match: null },
];

const LS_KEY = 'capitaly_rebalancing_target';

const DEFAULT_TARGETS = { actions: 40, crypto: 10, 'immo-frac': 5, scpi: 10, 'immo-phys': 15, matieres: 0, alternatifs: 5, cash: 10, materiel: 5 };

function loadTargets() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = { ...DEFAULT_TARGETS };
      CATS.forEach(c => { if (parsed[c.key] != null) base[c.key] = parsed[c.key]; });
      return base;
    }
  } catch {}
  return { ...DEFAULT_TARGETS };
}

function saveTargets(t) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(t)); } catch {}
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ fontWeight: 700, color: d.color, marginBottom: 2 }}>{d.name}</div>
      <div style={{ color: '#f1f5f9' }}>{fEur(d.value)}</div>
      <div style={{ color: '#9ca3af' }}>{d.pct?.toFixed(1)}%</div>
    </div>
  );
};

export default function Rebalancing({ T, data }) {
  const S = makeS(T);
  const [targets, setTargets] = useState(loadTargets);

  const { investments = [], cashTotal = 0, healthTotal = 0, invLiveValue } = data;

  const actualValues = useMemo(() => {
    const vals = {};
    CATS.forEach(cat => {
      if (cat.key === 'cash') { vals[cat.key] = cashTotal; return; }
      if (cat.key === 'materiel') { vals[cat.key] = healthTotal; return; }
      vals[cat.key] = investments
        .filter(inv => cat.match && cat.match(inv))
        .reduce((s, inv) => s + (invLiveValue ? invLiveValue(inv) : parseFloat(inv.value) || 0), 0);
    });
    return vals;
  }, [investments, cashTotal, healthTotal, invLiveValue]);

  const total = useMemo(() => Object.values(actualValues).reduce((s, v) => s + v, 0), [actualValues]);

  const totalTarget = useMemo(() => CATS.reduce((s, c) => s + (parseFloat(targets[c.key]) || 0), 0), [targets]);
  const targetOk = Math.abs(totalTarget - 100) < 0.5;

  const setTarget = (key, raw) => {
    const val = Math.max(0, Math.min(100, parseFloat(raw) || 0));
    const next = { ...targets, [key]: val };
    setTargets(next);
    saveTargets(next);
  };

  const rows = useMemo(() => CATS.map(cat => {
    const actualEur = actualValues[cat.key] || 0;
    const actualPct = total > 0 ? (actualEur / total) * 100 : 0;
    const targetPct = parseFloat(targets[cat.key]) || 0;
    const targetEur = total > 0 ? (targetPct / 100) * total : 0;
    const gapEur    = targetEur - actualEur;
    return { ...cat, actualEur, actualPct, targetPct, targetEur, gapEur };
  }), [actualValues, total, targets]);

  const pieData = useMemo(() => rows
    .filter(r => r.actualEur > 0.5)
    .map(r => ({ name: r.label, value: r.actualEur, color: r.color, pct: r.actualPct }))
  , [rows]);

  const movementsNeeded = rows.filter(r => Math.abs(r.gapEur) >= 10).length;
  const totalToBuy  = rows.filter(r => r.gapEur > 10).reduce((s, r) => s + r.gapEur, 0);
  const totalToSell = rows.filter(r => r.gapEur < -10).reduce((s, r) => s + Math.abs(r.gapEur), 0);

  const resetTargets = () => { const d = { ...DEFAULT_TARGETS }; setTargets(d); saveTargets(d); };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .reb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .reb-table-wrap { overflow-x: auto; }
        .reb-table { width: 100%; border-collapse: collapse; min-width: 560px; }
        .reb-table th { font-size: 10px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: .06em; padding: 8px 12px; text-align: right; white-space: nowrap; }
        .reb-table th:first-child { text-align: left; }
        .reb-table td { font-size: 12px; padding: 10px 12px; border-top: 1px solid ${T.cardBorder}; text-align: right; color: ${T.text}; vertical-align: middle; }
        .reb-table td:first-child { text-align: left; }
        .reb-table tr:hover td { background: ${T.cardBg}; }
        .reb-cards { display: none; flex-direction: column; gap: 10px; }
        @media (max-width: 768px) {
          .reb-grid { grid-template-columns: 1fr; }
          .reb-table-wrap { display: none; }
          .reb-cards { display: flex; }
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>🎯 Rebalancing</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>
          {total > 0
            ? `Patrimoine analysé : ${fEur(total)} — comparez votre allocation actuelle à votre cible`
            : 'Ajoutez des investissements pour analyser votre allocation'}
        </p>
      </div>

      {total === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: T.textFaint }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: T.textMuted }}>Aucun patrimoine à analyser</div>
          <div style={{ fontSize: 13 }}>Commencez par ajouter des enveloppes d'investissement, de l'épargne ou des actifs.</div>
        </div>
      )}

      {total > 0 && (
        <>
          {/* ── Allocation actuelle + cible ─────────────────────────────────── */}
          <div className="reb-grid">

            {/* Camembert */}
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Allocation actuelle</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {rows.filter(r => r.actualEur > 0.5).map(r => (
                  <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                      <span style={{ color: T.textMuted }}>{r.icon} {r.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ color: T.textFaint, fontSize: 11 }}>{fEur(r.actualEur, true)}</span>
                      <span style={{ fontWeight: 700, color: T.text, minWidth: 36, textAlign: 'right' }}>{r.actualPct.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sliders cible */}
            <div style={{ ...S.card }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Allocation cible</h3>
                <button onClick={resetTargets} style={{ ...S.btnS, fontSize: 10, padding: '3px 8px' }}>Réinitialiser</button>
              </div>

              {!targetOk && (
                <div style={{ background: 'rgba(251,146,60,.1)', border: '1px solid rgba(251,146,60,.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#fb923c', display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚠️ Total : {totalTarget.toFixed(1)}%</span>
                  <span>{totalTarget > 100 ? `+${(totalTarget - 100).toFixed(1)}% à réduire` : `${(100 - totalTarget).toFixed(1)}% manquants`}</span>
                </div>
              )}
              {targetOk && (
                <div style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 10, padding: '7px 12px', marginBottom: 12, fontSize: 12, color: '#4ade80' }}>
                  ✓ Total 100% — allocation valide
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {CATS.map(cat => {
                  const val = parseFloat(targets[cat.key]) || 0;
                  return (
                    <div key={cat.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: T.textMuted, flex: 1 }}>{cat.icon} {cat.label}</span>
                        <input
                          type="number" min="0" max="100" step="1"
                          value={val}
                          onChange={e => setTarget(cat.key, e.target.value)}
                          style={{ ...S.inp, width: 56, textAlign: 'right', padding: '3px 6px', fontSize: 12 }}
                        />
                        <span style={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" step="1"
                        value={val}
                        onChange={e => setTarget(cat.key, e.target.value)}
                        style={{ width: '100%', cursor: 'pointer', accentColor: cat.color }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Tableau de rééquilibrage ────────────────────────────────────── */}
          <div style={{ ...S.card }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Tableau de rééquilibrage</h3>

            {/* Table desktop */}
            <div className="reb-table-wrap">
              <table className="reb-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Catégorie</th>
                    <th>Actuel €</th>
                    <th>Actuel %</th>
                    <th>Cible %</th>
                    <th>Cible €</th>
                    <th>Écart €</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const over  = r.gapEur < -10;
                    const under = r.gapEur >  10;
                    const gapColor = over ? '#f87171' : under ? '#4ade80' : T.textFaint;
                    return (
                      <tr key={r.key}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{r.icon} {r.label}</span>
                          </div>
                        </td>
                        <td style={{ color: T.textMuted }}>{fEur(r.actualEur)}</td>
                        <td>
                          <span style={{ background: r.color + '22', color: r.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                            {r.actualPct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ color: T.textMuted }}>{r.targetPct.toFixed(0)}%</td>
                        <td style={{ color: T.textMuted }}>{fEur(r.targetEur)}</td>
                        <td style={{ color: gapColor, fontWeight: 600 }}>
                          {Math.abs(r.gapEur) < 10 ? '—' : (r.gapEur > 0 ? '+' : '') + fEur(r.gapEur)}
                        </td>
                        <td>
                          {Math.abs(r.gapEur) < 10
                            ? <span style={{ fontSize: 11, color: T.textFaint }}>✓ OK</span>
                            : under
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,.12)', padding: '2px 8px', borderRadius: 6 }}>
                                  ↑ Acheter {fEur(r.gapEur)}
                                </span>
                              : <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,.12)', padding: '2px 8px', borderRadius: 6 }}>
                                  ↓ Vendre {fEur(Math.abs(r.gapEur))}
                                </span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards mobile */}
            <div className="reb-cards">
              {rows.map(r => {
                const over  = r.gapEur < -10;
                const under = r.gapEur >  10;
                const gapColor = over ? '#f87171' : under ? '#4ade80' : T.textFaint;
                return (
                  <div key={r.key} style={{ background: T.bg2, borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${r.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{r.icon} {r.label}</span>
                      </div>
                      {Math.abs(r.gapEur) < 10
                        ? <span style={{ fontSize: 11, color: T.textFaint }}>✓ OK</span>
                        : under
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,.12)', padding: '2px 8px', borderRadius: 6 }}>
                              ↑ +{fEur(r.gapEur)}
                            </span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,.12)', padding: '2px 8px', borderRadius: 6 }}>
                              ↓ {fEur(Math.abs(r.gapEur))}
                            </span>
                      }
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Actuel',      val: `${r.actualPct.toFixed(1)}%`, sub: fEur(r.actualEur, true) },
                        { label: 'Cible',        val: `${r.targetPct.toFixed(0)}%`, sub: fEur(r.targetEur, true) },
                        { label: 'Écart',        val: Math.abs(r.gapEur) < 10 ? '—' : (r.gapEur > 0 ? '+' : '') + fEur(r.gapEur, true), sub: '', color: gapColor },
                      ].map(({ label, val, sub, color }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: color || T.text }}>{val}</div>
                          {sub && <div style={{ fontSize: 10, color: T.textFaint }}>{sub}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Résumé ──────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Patrimoine analysé', val: fEur(total, true),        icon: '🏛️', color: T.accent },
              { label: 'Mouvements à faire',  val: String(movementsNeeded),  icon: '🔄', color: movementsNeeded > 0 ? '#fb923c' : '#4ade80' },
              { label: 'Total à acheter',     val: fEur(totalToBuy, true),   icon: '↑',  color: '#4ade80' },
              { label: 'Total à vendre',      val: fEur(totalToSell, true),  icon: '↓',  color: '#f87171' },
            ].map(({ label, val, icon, color }) => (
              <div key={label} style={{ ...S.card, padding: '14px 18px' }}>
                <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{icon} {label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          {movementsNeeded > 0 && (
            <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '12px 16px', fontSize: 11, color: T.textFaint }}>
              💡 Les montants sont calculés sur la base de votre patrimoine total ({fEur(total, true)}).
              {!targetOk && ' ⚠️ Réglez l\'allocation cible à 100% pour des calculs précis.'}
              {' '}Les suggestions ne constituent pas un conseil en investissement.
            </div>
          )}
        </>
      )}
    </div>
  );
}
