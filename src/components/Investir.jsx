import { PLATFORMS } from '../utils/constants';

export default function Investir({ T }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>Investir</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Plateformes recommandées pour investir et gérer vos finances</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {PLATFORMS.map(p => (
          <div key={p.name} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform .15s, box-shadow .15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${p.color}22`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>

            {/* Color accent bar */}
            <div style={{ height: 4, background: `linear-gradient(90deg, ${p.color}, ${p.color}99)` }} />

            <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: p.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {p.emoji}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                    {p.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, background: p.color + '18', color: p.color, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, flex: 1 }}>{p.desc}</p>

              {/* CTA */}
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: p.color + '18', border: `1px solid ${p.color}44`, color: p.color, borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'background .15s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = p.color + '30'; }}
                onMouseLeave={e => { e.currentTarget.style.background = p.color + '18'; }}>
                Ouvrir un compte <span style={{ fontSize: 14 }}>→</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(251,146,60,.06)', border: '1px solid rgba(251,146,60,.15)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: '#fb923c' }}>
        ⚠ Ces liens sont fournis à titre informatif. Capitaly ne perçoit aucune commission d'affiliation. Investir comporte des risques — lisez les conditions générales de chaque plateforme.
      </div>
    </div>
  );
}
