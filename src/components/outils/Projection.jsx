import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KPI, TT, makeS } from '../../utils/constants';
import { useTranslation } from '../../hooks/useTranslation';

function formatCompact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M€';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k€';
  return n.toFixed(0) + '€';
}

export default function Projection({ T, data }) {
  const S = makeS(T);
  const { t } = useTranslation();
  const {
    projYears, setProjYears, projRate, setProjRate,
    projMonthly, setProjMonthly, projData, patrimoine,
  } = data;

  const fin = projData[projData.length - 1] || { Projection: patrimoine, Base: patrimoine };
  const interests = fin.Projection - fin.Base;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowX: 'hidden', maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .proj-sliders {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .proj-kpis {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .proj-milestones {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 768px) {
          .proj-sliders { grid-template-columns: 1fr; }
          .proj-kpis    { grid-template-columns: 1fr; }
          .proj-milestones { grid-template-columns: 1fr 1fr; }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #f97316;
          cursor: grab;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        input[type=range]:active::-webkit-slider-thumb { cursor: grabbing; }
        input[type=range]::-moz-range-thumb {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #f97316;
          cursor: grab;
          border: 2px solid white;
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📊 Projection</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Simulez l'évolution de votre patrimoine</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>{t('proj_title')}</h3>
          <div className="proj-sliders">
            {[
              { label: t('proj_duration'),        val: projYears,   set: setProjYears,   min: 1, max: 40,   unit: ` ${t('proj_years')}`, step: 1 },
              { label: t('proj_rate'),             val: projRate,    set: setProjRate,    min: 1, max: 20,   unit: '%',       step: 0.5 },
              { label: t('proj_monthly_contrib'),  val: projMonthly, set: setProjMonthly, min: 0, max: 5000, unit: ' €/mois', step: 50 },
            ].map(({ label, val, set, min, max, unit, step }) => {
              const pct = ((val - min) / (max - min)) * 100;
              return (
              <div key={label}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range" min={min} max={max} step={step} value={val}
                    onInput={e => set(Number(e.target.value))}
                    onChange={e => set(Number(e.target.value))}
                    style={{
                      flex: 1, minWidth: 0,
                      WebkitAppearance: 'none', appearance: 'none',
                      width: '100%', height: '6px', borderRadius: '3px',
                      outline: 'none', cursor: 'grab', touchAction: 'pan-x', userSelect: 'none', pointerEvents: 'auto',
                      background: `linear-gradient(to right, #f97316 ${pct}%, #374151 ${pct}%)`,
                    }}
                  />
                  <input
                    type="number" min={min} max={max} step={step} value={val}
                    onChange={e => set(+e.target.value)}
                    onBlur={e => set(Math.min(max, Math.max(min, +e.target.value)))}
                    style={{ width: 80, textAlign: 'right', flexShrink: 0, background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '4px 8px', fontSize: 13, color: T.text, fontFamily: 'inherit' }}
                  />
                  {unit.trim() && <span style={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>{unit.trim()}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint, marginTop: 2 }}>
                  <span>{min}{unit}</span><span>{max}{unit}</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="proj-kpis">
          <KPI T={T} label={t('proj_start')}                                value={formatCompact(patrimoine)}                          icon="💰" />
          <KPI T={T} label={t('proj_in_n_years', projYears)}                value={formatCompact(fin.Projection)} accent={T.accent} icon="🚀" />
          <KPI T={T} label={t('proj_total_payments')}                       value={formatCompact(projMonthly * 12 * projYears)}     icon="📅" />
          <KPI T={T} label={t('proj_interests')}                            value={formatCompact(interests)}      accent="#4ade80"  icon="✨" />
        </div>

        <div style={{ ...S.card, minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.text }}>{t('proj_evolution')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={projData}>
              <defs>
                <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.accent} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
              <XAxis dataKey="year" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCompact(v)} width={55} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="Base"       name={t('proj_no_return')}   stroke="#60a5fa" fill="url(#bG)" strokeWidth={1.5} strokeDasharray="4 3" />
              <Area type="monotone" dataKey="Projection" name={t('proj_with_return')} stroke={T.accent} fill="url(#pG)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...S.card, minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>{t('proj_milestones')}</h3>
          <div className="proj-milestones">
            {[1, 2, 5, 10, 20, 30].filter(y => y <= projYears && projData[y]).map(y => (
              <div key={y} style={{ padding: 14, background: T.bg2, borderRadius: 12, textAlign: 'center', minWidth: 0 }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>{t('proj_in')} {y} {t('proj_years')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>{formatCompact(projData[y].Projection)}</div>
                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>×{(projData[y].Projection / Math.max(1, patrimoine)).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
