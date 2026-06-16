import { useState } from 'react';
import { PLATFORMS, PLATFORM_CATEGORY_COLORS } from '../utils/constants';
import { AssetLogo } from './Modals';

const ORANGE = '#fb923c';
const CATEGORIES = [
  { key: 'Tous', label: 'Tous' },
  { key: 'Crypto', label: 'Crypto' },
  { key: 'Bourse', label: 'Bourse' },
  { key: 'Immobilier', label: 'Immobilier' },
  { key: 'Banque', label: 'Banque & Paiement' },
];
const PILL_PALETTE = ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#facc15', '#fb923c'];

export default function Investir({ T }) {
  const [activeCat, setActiveCat] = useState('Tous');
  const platforms = activeCat === 'Tous' ? PLATFORMS : PLATFORMS.filter(p => p.categories.includes(activeCat));

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .inv-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
        @media (min-width: 640px)  { .inv-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .inv-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .inv-card:hover { transform: scale(1.02); box-shadow: 0 12px 32px rgba(251,146,60,.18); }
        .inv-cta:hover { background: #fb923c !important; color: #131920 !important; }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>Découvrez nos partenaires</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Les meilleures plateformes pour investir et faire fructifier votre patrimoine</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setActiveCat(c.key)} style={{
            background: activeCat === c.key ? ORANGE + '22' : T.cardBg,
            border: `1px solid ${activeCat === c.key ? ORANGE : T.cardBorder}`,
            color: activeCat === c.key ? ORANGE : T.textMuted,
            borderRadius: 999, padding: '7px 16px', fontSize: 13,
            fontWeight: activeCat === c.key ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background .15s, border-color .15s, color .15s',
          }}>{c.label}</button>
        ))}
      </div>

      <div className="inv-grid">
        {platforms.map(p => {
          const badgeColor = PLATFORM_CATEGORY_COLORS[p.categories[0]];
          return (
            <div key={p.name} className="inv-card" style={{ background: '#131920', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, transition: 'transform .15s, box-shadow .15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <AssetLogo sources={[`https://img.logo.dev/${p.domain}?token=pk_X4dPbXQbTBuiGqrJH9u8VA&size=64`]} letter={p.emoji} color={badgeColor} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{p.name}</div>
                  <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: badgeColor + '22', color: badgeColor }}>
                    {p.categories.join(' + ')}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1, margin: 0 }}>{p.desc}</p>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.actifs.map((a, i) => (
                  <span key={a} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: PILL_PALETTE[i % PILL_PALETTE.length] + '1c', color: PILL_PALETTE[i % PILL_PALETTE.length] }}>{a}</span>
                ))}
              </div>

              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inv-cta"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: ORANGE, color: '#131920', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700, textDecoration: 'none', width: '100%', boxSizing: 'border-box', transition: 'background .15s' }}>
                S'inscrire <span style={{ fontSize: 15 }}>→</span>
              </a>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: '#4b5563' }}>
        ⚠ Ces liens sont fournis à titre informatif. Capitaly peut percevoir une commission d'affiliation. Investir comporte des risques — lisez les conditions générales de chaque plateforme.
      </div>
    </div>
  );
}
