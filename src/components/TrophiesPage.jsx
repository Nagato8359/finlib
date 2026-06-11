import { useMemo } from 'react';
import { computeTrophies, TROPHY_CATEGORIES } from '../utils/trophies';

export default function TrophiesPage({ T, accent, onBack, data }) {
  const { trophies, totalPoints, status, nextStatus, progressPct, pointsToNext, unlockedCount, totalCount } =
    useMemo(() => computeTrophies(data), [ // eslint-disable-line react-hooks/exhaustive-deps
      data.patrimoine, data.investments, data.invLiveValue, data.income, data.savingsRate,
      data.transactions, data.budgets, data.goals, data.soldHistory,
      data.score, data.user,
    ]);

  const byCategory = useMemo(() => {
    const map = {};
    TROPHY_CATEGORIES.forEach(c => { map[c.key] = []; });
    trophies.forEach(t => { if (map[t.cat]) map[t.cat].push(t); });
    return map;
  }, [trophies]);

  return (
    <div>
      {/* ── Back header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 10px', borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 10 }}>
        <button
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 18, padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit', display: 'flex', alignItems: 'center', lineHeight: 1, transition: 'background .1s' }}
          onMouseEnter={e => { e.currentTarget.style.background = T.cardBg; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textMuted; }}
        >
          ←
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1 }}>Trophées & Statut</span>
        <span style={{ fontSize: 11, color: T.textFaint }}>{unlockedCount}/{totalCount}</span>
      </div>

      {/* ── Status card ── */}
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '16px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 34, lineHeight: 1 }}>{status.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: '-.02em' }}>{status.label}</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 1 }}>
              {totalPoints} pt{totalPoints > 1 ? 's' : ''}
              {nextStatus ? ` · ${pointsToNext} pts pour ${nextStatus.icon} ${nextStatus.label}` : ' · Niveau maximum 🚀'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: accent, letterSpacing: '-.03em' }}>{totalPoints}</div>
            <div style={{ fontSize: 10, color: T.textFaint }}>points</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: T.bg2, borderRadius: 8, height: 8, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg,${accent},${accent}cc)`, borderRadius: 8, transition: 'width .5s' }} />
        </div>
        {nextStatus && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textFaint }}>
            <span>{status.icon} {status.label} ({status.min} pts)</span>
            <span>{nextStatus.icon} {nextStatus.label} ({nextStatus.min} pts)</span>
          </div>
        )}

        {/* Unlocked count */}
        <div style={{ marginTop: 12, padding: '10px 12px', background: T.bg2, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>Trophées débloqués</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{unlockedCount} <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 400 }}>/ {totalCount}</span></span>
        </div>
      </div>

      {/* ── Categories ── */}
      {TROPHY_CATEGORIES.map(cat => {
        const items = byCategory[cat.key] || [];
        const catUnlocked = items.filter(t => t.unlocked).length;
        return (
          <div key={cat.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 8px', borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textFaint }}>{cat.label}</span>
              </div>
              <span style={{ fontSize: 11, color: T.textFaint }}>{catUnlocked}/{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: t.unlocked ? T.cardBg : T.bg2,
                    border: `1px solid ${t.unlocked ? accent + '33' : T.cardBorder}`,
                    borderRadius: 10,
                    opacity: t.unlocked ? 1 : 0.55,
                  }}
                >
                  <div style={{
                    fontSize: 20, lineHeight: 1, flexShrink: 0,
                    filter: t.unlocked ? 'none' : 'grayscale(100%)',
                  }}>
                    {t.unlocked ? t.icon : '🔒'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.unlocked ? T.text : T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>{t.desc}</div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: t.unlocked ? accent : T.textFaint,
                    background: t.unlocked ? accent + '18' : T.cardBorder + '44',
                    padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {t.pts} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
