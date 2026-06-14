import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KPI, makeS, fEur } from '../../utils/constants';

const MONTHS_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

export default function CalendrierDividendes({ T, data }) {
  const S = makeS(T);
  const cy = new Date().getFullYear();
  const [year, setYear] = useState(cy);
  const { allDividends } = data;

  const yrStr = String(year);
  const divsYear = (allDividends || []).filter(d => d.date?.startsWith(yrStr));

  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const entries = divsYear.filter(d => d.date?.startsWith(`${yrStr}-${m}`));
    return {
      month: MONTHS_SHORT[i],
      amount: entries.reduce((s, d) => s + d.amount, 0),
      count: entries.length,
      entries,
    };
  });

  const total    = divsYear.reduce((s, d) => s + d.amount, 0);
  const monthly  = total / 12;
  const active   = byMonth.filter(m => m.amount > 0).length;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📅 Calendrier dividendes</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Versements reçus mois par mois</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[cy - 1, cy, cy + 1].map(y => (
            <button key={y} onClick={() => setYear(y)}
              style={{ background: y === year ? T.accent + '22' : T.cardBg, border: `1px solid ${y === year ? T.accent : T.cardBorder}`, color: y === year ? T.accent : T.textMuted, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {(allDividends || []).length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 60, color: T.textFaint }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Aucun dividende enregistré</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>Ajoutez des dividendes depuis Patrimoine → Investissements</div>
        </div>
      ) : (
        <>
          <div className="g4">
            <KPI T={T} label={`Total ${year}`} value={fEur(total, true)} accent="#4ade80" icon="💸" />
            <KPI T={T} label="Versements" value={divsYear.length} icon="📅" />
            <KPI T={T} label="Moyenne mensuelle" value={fEur(monthly)} icon="⌀" />
            <KPI T={T} label="Mois actifs" value={active} icon="📊" />
          </div>

          {total > 0 && (
            <div style={{ ...S.card }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>Répartition mensuelle</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byMonth} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                  <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? fEur(v, true) : ''} width={44} />
                  <Tooltip formatter={v => [fEur(v), 'Dividendes']} contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="amount" fill="#4ade80" radius={[4, 4, 0, 0]} name="Dividendes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {byMonth.map((m, i) => (
              <div key={i} style={{ ...S.card, padding: '14px 16px', opacity: m.amount === 0 ? 0.42 : 1, transition: 'opacity .15s' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>{MONTHS_LONG[i]}</div>
                {m.amount > 0 ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>{fEur(m.amount)}</div>
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>
                      {m.count} versement{m.count !== 1 ? 's' : ''}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {m.entries.map((d, j) => (
                        <div key={j} style={{ fontSize: 10, color: T.textFaint, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{d.date?.slice(8)}/{String(i + 1).padStart(2, '0')}</span>
                          <span style={{ color: '#4ade80' }}>+{fEur(d.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: T.textFaint }}>—</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
