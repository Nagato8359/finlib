import { useState } from 'react';
import { makeS, fEur } from '../../utils/constants';

export default function RecapFiscal({ T, data }) {
  const S = makeS(T);
  const cy = new Date().getFullYear();
  const [year, setYear] = useState(cy);

  const { allDividends, investments, invLiveValue } = data;
  const yrStr = String(year);

  const divsYear   = (allDividends || []).filter(d => d.date?.startsWith(yrStr));
  const divsGross  = divsYear.filter(d =>  d.gross).reduce((s, d) => s + d.amount, 0);
  const divsNet    = divsYear.filter(d => !d.gross).reduce((s, d) => s + d.amount, 0);
  const divTotal   = divsYear.reduce((s, d) => s + d.amount, 0);

  const immoEnvs       = (investments || []).filter(inv => inv.type === 'Immobilier');
  const loyersAnnuels  = immoEnvs.reduce((s, inv) => s + (parseFloat(inv.loyerMensuel)      || 0) * 12, 0);
  const chargesAnnuel  = immoEnvs.reduce((s, inv) => s + (parseFloat(inv.chargesMensuelles) || 0) * 12, 0);

  const immoTotal    = invLiveValue ? immoEnvs.reduce((s, inv) => s + invLiveValue(inv), 0) : 0;
  const ifiThreshold = 1_300_000;
  const ifiEstim     = immoTotal > ifiThreshold ? (immoTotal - ifiThreshold) * 0.005 : 0;

  const Section = ({ title, icon, children, color }) => (
    <div style={{ ...S.card, borderLeft: `3px solid ${color || T.accent}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </h3>
      {children}
    </div>
  );

  const Row = ({ label, value, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
      <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || T.text }}>{value}</span>
    </div>
  );

  const Empty = ({ msg }) => (
    <div style={{ fontSize: 12, color: T.textFaint, fontStyle: 'italic' }}>{msg}</div>
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📋 Récap fiscal</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Synthèse fiscale estimative — année {year}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[cy - 1, cy, cy + 1].map(y => (
              <button key={y} onClick={() => setYear(y)}
                style={{ background: y === year ? T.accent + '22' : T.cardBg, border: `1px solid ${y === year ? T.accent : T.cardBorder}`, color: y === year ? T.accent : T.textMuted, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {y}
              </button>
            ))}
          </div>
          <button style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', borderRadius: 8, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => alert('Export PDF en cours de développement')}>
            📄 Exporter PDF
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#fbbf24', lineHeight: 1.55 }}>
        ⚠️ Ces données sont calculées à partir de vos saisies et fournies à titre indicatif uniquement. Consultez un expert-comptable pour votre déclaration fiscale.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Section title="Plus-values réalisées" icon="📈" color="#a78bfa">
          <Empty msg={`Le suivi des cessions n'est pas encore disponible. Les plus-values pour ${year} ne peuvent pas être calculées automatiquement.`} />
        </Section>

        <Section title="Dividendes reçus" icon="💸" color="#4ade80">
          {divTotal === 0
            ? <Empty msg={`Aucun dividende enregistré pour ${year}.`} />
            : <>
                <Row label="Dividendes bruts saisis"       value={fEur(divsGross)} />
                <Row label="Dividendes nets saisis"        value={fEur(divsNet)} />
                <Row label="Total perçu"                   value={fEur(divTotal)}       color="#4ade80" bold />
                <Row label="PFU 30% estimé (sur brut)"    value={fEur(divsGross * 0.30)} color="#f87171" />
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
                  Abattement 40% applicable si option barème progressif (dividendes uniquement).
                </div>
              </>
          }
        </Section>

        <Section title="Revenus fonciers / loyers" icon="🏠" color="#60a5fa">
          {loyersAnnuels === 0
            ? <Empty msg="Aucune enveloppe Immobilier avec loyers renseignés." />
            : <>
                <Row label="Loyers bruts annuels"         value={fEur(loyersAnnuels)} />
                <Row label="Charges déductibles annuelles" value={fEur(chargesAnnuel)} color="#f87171" />
                <Row label="Revenu foncier net estimé"    value={fEur(loyersAnnuels - chargesAnnuel)} color="#4ade80" bold />
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
                  Régime micro-foncier : 30% d'abattement si revenus &lt; 15 000 €/an.
                </div>
              </>
          }
        </Section>

        <Section title="Revenus RealT (USDC)" icon="🏘️" color="#F59E0B">
          <Empty msg="Les loyers RealT sont des revenus en USDC sur la blockchain Gnosis. Consultez Patrimoine → RealT pour l'historique. Leur traitement fiscal dépend de votre situation personnelle." />
        </Section>

        <Section title="IFI estimé" icon="🏛️" color="#f87171">
          <Row label="Valeur immobilière totale" value={fEur(immoTotal)} />
          <Row label="Seuil IFI"                value={fEur(ifiThreshold)} />
          {immoTotal <= ifiThreshold
            ? <div style={{ fontSize: 12, color: '#4ade80', marginTop: 10 }}>
                ✓ Patrimoine immobilier sous le seuil IFI ({fEur(ifiThreshold)})
              </div>
            : <>
                <Row label="Base taxable estimée"        value={fEur(immoTotal - ifiThreshold)} color="#f87171" />
                <Row label="IFI estimé (taux min 0,5%)" value={fEur(ifiEstim)}                  color="#f87171" bold />
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
                  Calcul simplifié. L'IFI réel dépend du barème progressif, des dettes déductibles et d'autres paramètres.
                </div>
              </>
          }
        </Section>
      </div>
    </div>
  );
}
