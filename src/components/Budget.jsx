import { makeS, fEur, fDate, CAT_COLORS } from '../utils/constants';

export default function Budget({ T, data }) {
  const S = makeS(T);
  const { budgets, setBudgets, budgetProgress, goals, patrimoine, setModal, setEditItem, setGoalForm, delGoal, mkGoal } = data;

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
    </div>
  );
}
