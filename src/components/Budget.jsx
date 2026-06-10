import { makeS, fEur, fDate, CAT_COLORS } from '../utils/constants';

const mLeft = endDate => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, months);
};

export default function Budget({ T, data }) {
  const S = makeS(T);
  const {
    budgets, setBudgets, budgetProgress, goals, patrimoine,
    setModal, setEditItem, setGoalForm, delGoal, mkGoal,
    debts, totalConsumerDebt, endettementRate, monthlyDebtPayments, income,
    openEditDebt, delDebt,
  } = data;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>Budget & Objectifs</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Plafonds mensuels et buts financiers</p>
        </div>
        <button onClick={() => { setEditItem(null); setGoalForm(mkGoal()); setModal('goal'); }} style={{ ...S.btnG, fontSize: 12, padding: '7px 16px' }}>
          + Objectif
        </button>
      </div>

      {/* Taux d'endettement */}
      {monthlyDebtPayments > 0 && (
        <div style={{ background: endettementRate > 33 ? 'rgba(248,113,113,.08)' : 'rgba(16,185,129,.06)', border: `1px solid ${endettementRate > 33 ? 'rgba(248,113,113,.3)' : 'rgba(16,185,129,.2)'}`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Taux d'endettement</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{fEur(monthlyDebtPayments)}/mois de mensualités · revenus {fEur(income)}/mois</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: endettementRate > 33 ? '#f87171' : '#4ade80' }}>{endettementRate.toFixed(0)}%</div>
              {endettementRate > 33 && <div style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>⚠ LIMITE 33% DÉPASSÉE</div>}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, endettementRate)}%`, height: '100%', background: endettementRate > 33 ? '#f87171' : '#10b981', borderRadius: 6, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: endettementRate > 33 ? '#f87171' : T.textMuted }}>Limite légale : 33%</span>
          </div>
        </div>
      )}

      <div className="g2">
        {/* Budget mensuels */}
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Budgets mensuels</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(budgets).map(([cat, limit]) => {
              const { spent, pct } = budgetProgress[cat] || { spent: 0, pct: 0 };
              const barColor = pct >= 100 ? '#f87171' : pct >= 80 ? '#fb923c' : '#10b981';
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 3, background: CAT_COLORS[cat] || '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{cat}</span>
                      {pct >= 100 && <span style={{ fontSize: 10, background: 'rgba(248,113,113,.15)', color: '#f87171', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>DÉPASSÉ</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: T.textMuted }}>{fEur(spent)} /</span>
                      <input type="number" value={limit}
                        onChange={e => setBudgets(p => ({ ...p, [cat]: +e.target.value }))}
                        style={{ ...S.inp, width: 72, padding: '3px 8px', fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: T.textMuted }}>€</span>
                    </div>
                  </div>
                  <div style={{ background: T.cardBorder, borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor, borderRadius: 6, transition: 'width .4s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                    <span style={{ color: barColor, fontWeight: 600 }}>{Math.round(pct)}%</span>
                    <span style={{ color: T.textFaint }}>Reste : {fEur(Math.max(0, limit - spent))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Objectifs financiers */}
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>Objectifs financiers</h3>
          {goals.length === 0 ? (
            <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
              <div>Définissez votre premier objectif financier</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {goals.map(g => {
                const pct = Math.min(100, (patrimoine / g.target) * 100);
                const monthsLeft = Math.max(0, Math.round((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)));
                const needed = g.target - patrimoine;
                const perMonth = monthsLeft > 0 ? needed / monthsLeft : 0;
                return (
                  <div key={g.id} style={{ padding: 16, background: T.bg2, borderRadius: 14, borderLeft: `4px solid ${g.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{g.name}</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setEditItem(g); setGoalForm(g); setModal('goal'); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                        <button onClick={() => delGoal(g.id)} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                    <div style={{ background: T.cardBorder, borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: g.color, borderRadius: 6, transition: 'width .5s' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                      <div><span style={{ color: T.textMuted }}>Atteint : </span><span style={{ color: g.color, fontWeight: 700 }}>{pct.toFixed(0)}%</span></div>
                      <div><span style={{ color: T.textMuted }}>Objectif : </span><span style={{ color: T.text, fontWeight: 600 }}>{fEur(g.target, true)}</span></div>
                      <div><span style={{ color: T.textMuted }}>Échéance : </span><span style={{ color: T.text }}>{fDate(g.deadline)} ({monthsLeft} mois)</span></div>
                      {perMonth > 0 && <div><span style={{ color: T.textMuted }}>Effort/mois : </span><span style={{ color: '#fb923c', fontWeight: 600 }}>{fEur(perMonth, true)}</span></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Crédits consommation */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Crédits consommation</h3>
            {debts.length > 0 && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                Capital restant : <span style={{ color: '#f87171', fontWeight: 600 }}>{fEur(totalConsumerDebt, true)}</span>
              </div>
            )}
          </div>
          <button onClick={() => { setEditItem(null); data.setDebtForm && data.setDebtForm(data.mkDebt()); setModal('debt'); }} style={{ ...S.btnS, fontSize: 12, padding: '6px 14px' }}>
            + Crédit conso
          </button>
        </div>
        {debts.length === 0 ? (
          <div style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>💳</div>
            <div>Aucun crédit conso — crédit auto, travaux…</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {debts.map(d => {
              const months = mLeft(d.endDate);
              return (
                <div key={d.id} style={{ padding: '14px 16px', background: T.bg2, borderRadius: 12, borderLeft: '3px solid #fb923c' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{d.name}</span>
                        {d.lender && <span style={{ fontSize: 10, background: 'rgba(251,146,60,.15)', color: '#fb923c', padding: '2px 7px', borderRadius: 20 }}>{d.lender}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint }}>
                        {d.rate > 0 ? `${parseFloat(d.rate).toFixed(2)}% · ` : ''}
                        {months > 0 ? `${months} mois restants` : d.endDate ? 'Terminé' : '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>{fEur(parseFloat(d.capitalRemaining) || 0)}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{fEur(parseFloat(d.monthlyPayment) || 0)}/mois</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => openEditDebt(d)} style={{ ...S.btnS, padding: '3px 8px', fontSize: 11 }}>✎</button>
                        <button onClick={() => delDebt(d.id)} style={{ ...S.btnD, padding: '3px 8px', fontSize: 11 }}>✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
