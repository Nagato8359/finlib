import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { KPI, TT, makeS, fEur } from '../../utils/constants';
import { useTranslation } from '../../hooks/useTranslation';

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
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📊 Projection</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Simulez l'évolution de votre patrimoine</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: T.text }}>{t('proj_title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
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
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
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
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>{t('proj_in')} {y} {t('proj_years')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>{fEur(projData[y].Projection, true)}</div>
                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>×{(projData[y].Projection / Math.max(1, patrimoine)).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
