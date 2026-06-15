import { useState } from 'react';
import { makeS, fDate } from '../utils/constants';

const SHARE_MSG = (code) =>
  `Rejoins-moi sur Capitaly, l'app de suivi de patrimoine ! Utilise mon code ${code} à l'inscription pour gagner 1 mois Pro gratuit 🎉 → capitaly.fr`;

export default function Parrainage({ T, data }) {
  const S = makeS(T);
  const { referralCode = '', referrals = [], proBonusMonths = 0, user, demoMode } = data;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Capitaly', text: SHARE_MSG(referralCode) }).catch(() => {});
    } else {
      navigator.clipboard.writeText(SHARE_MSG(referralCode)).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const confirmed = referrals.filter(r => r.status === 'confirmed');
  const pending   = referrals.filter(r => r.status !== 'confirmed');
  const monthsEarned = confirmed.length;

  if (!user && !demoMode) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: 48, color: T.textFaint }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>Connectez-vous pour accéder au parrainage</div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .par-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .par-code  { font-size: 36px; font-weight: 900; letter-spacing: .15em; color: ${T.accent}; font-variant-numeric: tabular-nums; }
        .par-step  { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; flex: 1; }
        .par-ref-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid ${T.cardBorder}; font-size: 12px; }
        @media (max-width: 640px) { .par-grid { grid-template-columns: 1fr; } .par-code { font-size: 28px; } }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>🎁 Parrainage</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Invitez vos proches et gagnez des mois Pro offerts</p>
      </div>

      <div className="par-grid">

        {/* ── Mon code ─────────────────────────────────────────────── */}
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 16 }}>Mon code de parrainage</h3>
          <div style={{ background: T.bg2, borderRadius: 16, padding: '20px 16px', textAlign: 'center', marginBottom: 16, border: `2px dashed ${T.accent}44` }}>
            <div className="par-code">{referralCode || '———'}</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>Partagez ce code à vos proches</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{ ...S.btnS, flex: 1, fontSize: 12, padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
            <button
              onClick={handleShare}
              style={{ ...S.btnG, flex: 1, fontSize: 12, padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              📤 Partager
            </button>
          </div>
        </div>

        {/* ── Mes filleuls ─────────────────────────────────────────── */}
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>Mes filleuls</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Filleuls parrainés', val: referrals.length, color: T.accent },
              { label: 'Mois Pro gagnés',   val: monthsEarned,      color: '#4ade80' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: T.bg2, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          {referrals.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.textFaint, fontSize: 13, padding: '16px 0' }}>
              Personne n'a encore utilisé votre code 😕<br />
              <span style={{ fontSize: 11 }}>Partagez-le pour commencer !</span>
            </div>
          ) : (
            <div>
              {[...confirmed, ...pending].map((r, i) => (
                <div key={r.id || i} className="par-ref-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: T.accent, fontWeight: 700 }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ color: T.textMuted, fontSize: 11 }}>Filleul #{i + 1}</div>
                      <div style={{ color: T.textFaint, fontSize: 10 }}>{r.created_at ? fDate(r.created_at.slice(0, 10)) : '—'}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: r.status === 'confirmed' ? 'rgba(74,222,128,.15)' : 'rgba(251,191,36,.15)',
                    color: r.status === 'confirmed' ? '#4ade80' : '#fbbf24',
                  }}>
                    {r.status === 'confirmed' ? '✓ Confirmé' : '⏳ En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Comment ça marche ──────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 20 }}>Comment ça marche ?</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { step: '1️⃣', title: 'Partagez votre code', desc: 'Envoyez votre code unique à vos proches par message, email ou réseaux sociaux.' },
            { step: '2️⃣', title: 'Ils s\'inscrivent', desc: 'Vos proches créent leur compte sur Capitaly en renseignant votre code à l\'inscription.' },
            { step: '3️⃣', title: 'Vous gagnez tous les deux', desc: 'Vous obtenez tous les deux 1 mois Pro gratuit, sans limite de parrainages !' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="par-step" style={{ minWidth: 180, flex: '1 1 180px' }}>
              <div style={{ fontSize: 32 }}>{step}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
              <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Statut Pro ─────────────────────────────────────────────── */}
      <div style={{ ...S.card, background: proBonusMonths > 0 ? 'rgba(74,222,128,.06)' : T.cardBg, border: `1px solid ${proBonusMonths > 0 ? 'rgba(74,222,128,.25)' : T.cardBorder}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              {proBonusMonths > 0 ? '🌟 Statut Pro actif' : '⭐ Statut Free'}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {proBonusMonths > 0
                ? `${proBonusMonths} mois bonus disponible${proBonusMonths > 1 ? 's' : ''} grâce au parrainage`
                : 'Parrainez des amis pour obtenir des mois Pro gratuits'}
            </div>
          </div>
          {proBonusMonths > 0 && (
            <div style={{ background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80' }}>{proBonusMonths}</div>
              <div style={{ fontSize: 10, color: '#4ade80' }}>mois Pro</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
