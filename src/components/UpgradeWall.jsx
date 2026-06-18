import React from 'react';

export default function UpgradeWall({ T, featureName }) {
  const handleUpgrade = () => alert('Stripe arrive bientôt !');

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '40px 16px',
    }}>
      <div style={{
        background: T.cardBg, border: `1px solid ${T.cardBorder}`,
        borderRadius: 16, padding: '40px 32px',
        textAlign: 'center', maxWidth: 420, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 48 }}>👑</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Fonctionnalité Pro</div>
        <div style={{ fontSize: 15, color: T.text }}>
          {featureName} est réservé aux abonnés Pro.
        </div>
        <div style={{ fontSize: 13, color: T.textMuted }}>
          À partir de 7,99€/mois — Annulable à tout moment.
        </div>
        <button
          onClick={handleUpgrade}
          style={{
            marginTop: 8,
            background: T.accent, color: '#fff',
            padding: '12px 24px', borderRadius: 10,
            border: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 600,
          }}
        >
          Passer en Pro →
        </button>
        <button
          onClick={handleUpgrade}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.textMuted, fontSize: 13, textDecoration: 'underline',
            padding: 0,
          }}
        >
          Voir les avantages Pro
        </button>
      </div>
    </div>
  );
}
