import { useState, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { makeS, fEur, KPI, PORTFOLIO_TYPE_ICON, PORTFOLIO_TYPE_COLOR } from '../../utils/constants';

const TMI_BRACKETS = [
  { max: 11294,    rate: 0 },
  { max: 28797,    rate: 11 },
  { max: 82341,    rate: 30 },
  { max: 177106,   rate: 41 },
  { max: Infinity, rate: 45 },
];

const PER_PLAFOND_MAX = 35194;
const PEA_PLAFOND = 150000;
const AV_ABATTEMENT = 4600;

const PRIORITY_ORDER = { haute: 0, moyenne: 1, faible: 2 };
const PRIORITY_COLOR = { haute: '#f87171', moyenne: '#fbbf24', faible: '#60a5fa' };
const PRIORITY_LABEL = { haute: 'Priorité haute', moyenne: 'Priorité moyenne', faible: 'Priorité faible' };

// Stored types occasionally carry a leftover emoji prefix from older form bugs.
const stripEmoji = s => (s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();
const norm = s => stripEmoji(s).toLowerCase();
const isPEA = inv => norm(inv.type) === 'pea';
const isCTO = inv => norm(inv.type) === 'cto';
const isAV  = inv => norm(inv.type).startsWith('assurance-vie');
const isPER = inv => norm(inv.type) === 'per';

function computeTMI(revenu, parts) {
  const quotient = revenu / Math.max(parseFloat(parts) || 1, 1);
  const bracket = TMI_BRACKETS.find(b => quotient <= b.max) || TMI_BRACKETS[TMI_BRACKETS.length - 1];
  return bracket.rate;
}

function yearsSince(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (isNaN(ms)) return null;
  return ms / (365.25 * 86400000);
}

export default function OptimisationFiscale({ T, data }) {
  const S = makeS(T);
  const { investments = [], invLiveValue, invLiveInvested, allDividends = [], soldProfitThisYear = 0 } = data || {};

  const [revenuImposable, setRevenuImposable] = useState(40000);
  const [situation, setSituation] = useState('celibataire');
  const [nombreParts, setNombreParts] = useState(1);

  const tmi = useMemo(() => computeTMI(revenuImposable, nombreParts), [revenuImposable, nombreParts]);

  const handleSituation = s => {
    setSituation(s);
    setNombreParts(s === 'celibataire' ? 1 : 2);
  };

  const envValue = useCallback(inv => invLiveValue ? invLiveValue(inv) : 0, [invLiveValue]);
  const envInvested = useCallback(inv => inv.positions?.length
    ? (invLiveInvested ? invLiveInvested(inv) : 0)
    : (parseFloat(inv.invested) || 0) + (parseFloat(inv.cash) || 0), [invLiveInvested]);

  const peaEnvs = useMemo(() => investments.filter(isPEA), [investments]);
  const ctoEnvs = useMemo(() => investments.filter(isCTO), [investments]);
  const avEnvs  = useMemo(() => investments.filter(isAV),  [investments]);
  const perEnvs = useMemo(() => investments.filter(isPER), [investments]);

  const peaInvestedTotal = useMemo(() => peaEnvs.reduce((s, inv) => s + envInvested(inv), 0), [peaEnvs, envInvested]);

  // ── Plus/moins-values latentes, position par position ─────────────────────
  const allPositions = useMemo(() => {
    const rows = [];
    for (const inv of investments) {
      for (const pos of inv.positions || []) {
        const shares = parseFloat(pos.shares) || 0;
        const buy = parseFloat(pos.buyPrice) || 0;
        const cur = parseFloat(pos.currentPrice) || 0;
        if (!shares || !buy || !cur) continue;
        const pv = (cur - buy) * shares;
        rows.push({ label: pos.ticker || pos.name || inv.name, envelope: inv.name, pv, taxIfSold: pv > 0 ? pv * 0.30 : 0 });
      }
    }
    return rows;
  }, [investments]);

  const topGains  = useMemo(() => [...allPositions].filter(r => r.pv > 0).sort((a, b) => b.pv - a.pv).slice(0, 5), [allPositions]);
  const topLosses = useMemo(() => [...allPositions].filter(r => r.pv < 0).sort((a, b) => a.pv - b.pv).slice(0, 5), [allPositions]);
  const totalLatentPV = useMemo(() => allPositions.reduce((s, r) => s + r.pv, 0), [allPositions]);

  // ── Recommandations ────────────────────────────────────────────────────────
  const recommendations = useMemo(() => {
    const recs = [];
    for (const inv of peaEnvs) {
      const yrs = yearsSince(inv.openDate);
      if (yrs != null && yrs < 5) {
        recs.push({ priority: 'haute', icon: '🏛️', text: `Votre PEA "${inv.name}" a ${yrs.toFixed(1)} an(s). Attendez encore ${(5 - yrs).toFixed(1)} an(s) pour l'exonération d'impôt sur le revenu (seuls les 17,2% de prélèvements sociaux resteront dus).` });
      }
    }
    if (ctoEnvs.length && tmi < 30) {
      const ctoNames = new Set(ctoEnvs.map(c => c.name));
      const ctoHasGains = allPositions.some(p => ctoNames.has(p.envelope) && p.pv > 0);
      if (ctoHasGains) {
        recs.push({ priority: 'moyenne', icon: '📈', text: `Votre TMI est de ${tmi}% (inférieure à 30%) : envisagez l'option pour le barème progressif sur vos dividendes CTO plutôt que le PFU, pour profiter de l'abattement de 40%.` });
      }
    }
    if (!perEnvs.length && tmi >= 30) {
      const plafond = Math.min(PER_PLAFOND_MAX, revenuImposable * 0.10);
      const economie = plafond * (tmi / 100);
      recs.push({ priority: 'haute', icon: '🧓', text: `Un versement PER de ${fEur(plafond)} vous ferait économiser environ ${fEur(economie)} d'impôt cette année (TMI ${tmi}%).` });
    }
    for (const inv of avEnvs) {
      const yrs = yearsSince(inv.openDate);
      if (yrs != null && yrs < 8) {
        recs.push({ priority: 'moyenne', icon: '🛡️', text: `Votre assurance-vie "${inv.name}" a ${yrs.toFixed(1)} an(s). Dans ${(8 - yrs).toFixed(1)} an(s), vous bénéficierez de l'abattement annuel de ${fEur(AV_ABATTEMENT)} sur les gains rachetés.` });
      }
    }
    if (peaInvestedTotal > 0 && peaInvestedTotal < PEA_PLAFOND && ctoEnvs.length) {
      recs.push({ priority: 'faible', icon: '💡', text: `Votre PEA n'est rempli qu'à ${((peaInvestedTotal / PEA_PLAFOND) * 100).toFixed(0)}% (${fEur(peaInvestedTotal)} / ${fEur(PEA_PLAFOND)}). Maximisez vos versements PEA avant d'investir via un CTO, fiscalement moins avantageux.` });
    }
    return recs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [peaEnvs, ctoEnvs, perEnvs, avEnvs, tmi, allPositions, revenuImposable, peaInvestedTotal]);

  // ── Récap fiscal annuel condensé ──────────────────────────────────────────
  const cy = new Date().getFullYear();
  const divsYear      = allDividends.filter(d => d.date?.startsWith(String(cy)));
  const divsGrossYear = divsYear.filter(d => d.gross).reduce((s, d) => s + d.amount, 0);
  const divsTotalYear = divsYear.reduce((s, d) => s + d.amount, 0);
  const pfuOnDividends = divsGrossYear * 0.30;

  // ── Répartition des enveloppes fiscales (camembert) ───────────────────────
  const pieData = useMemo(() => {
    const groups = [
      { key: 'PEA', label: 'PEA', envs: peaEnvs },
      { key: 'CTO', label: 'CTO', envs: ctoEnvs },
      { key: 'Assurance-vie', label: 'Assurance-vie', envs: avEnvs },
      { key: 'PER', label: 'PER', envs: perEnvs },
    ];
    const classified = new Set([...peaEnvs, ...ctoEnvs, ...avEnvs, ...perEnvs]);
    const autres = investments.filter(inv => !classified.has(inv));
    const rows = groups.map(g => ({
      name: g.label,
      value: g.envs.reduce((s, inv) => s + envValue(inv), 0),
      color: PORTFOLIO_TYPE_COLOR[g.key] || T.accent,
    }));
    rows.push({ name: 'Autres enveloppes', value: autres.reduce((s, inv) => s + envValue(inv), 0), color: '#94a3b8' });
    return rows.filter(r => r.value > 0.5);
  }, [peaEnvs, ctoEnvs, avEnvs, perEnvs, investments, T.accent, envValue]);

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

  const Empty = ({ msg }) => <div style={{ fontSize: 12, color: T.textFaint, fontStyle: 'italic' }}>{msg}</div>;

  const StatusBadge = ({ status, label }) => {
    const colors = { vert: '#4ade80', orange: '#fbbf24', rouge: '#f87171' };
    const c = colors[status] || T.textFaint;
    return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: c + '22', color: c }}>{label}</span>;
  };

  const EnvelopeCard = ({ inv, typeKey, ageThreshold, ageLabel }) => {
    const yrs = yearsSince(inv.openDate);
    const status = yrs == null ? 'orange' : yrs >= ageThreshold ? 'vert' : yrs >= ageThreshold / 2 ? 'orange' : 'rouge';
    const statusLabel = yrs == null ? 'Ancienneté inconnue' : yrs >= ageThreshold ? 'Optimal' : `${(ageThreshold - yrs).toFixed(1)} an(s) restants`;
    return (
      <div style={{ background: T.bg2, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{PORTFOLIO_TYPE_ICON[typeKey] || ''} {inv.name}</span>
          <StatusBadge status={status} label={statusLabel} />
        </div>
        <Row label="Valeur actuelle" value={fEur(envValue(inv))} />
        <Row label="Capital investi" value={fEur(envInvested(inv))} />
        <Row label={ageLabel} value={inv.openDate ? `${yrs.toFixed(1)} an(s)` : 'Date d\'ouverture non renseignée'} />
      </div>
    );
  };

  const inp = { background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .of-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .of-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .of-pv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 768px) {
          .of-grid { grid-template-columns: 1fr; }
          .of-kpis { grid-template-columns: 1fr 1fr; }
          .of-pv-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>💰 Optimisation fiscale</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Analyse de vos enveloppes et recommandations personnalisées</p>
      </div>

      <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#fbbf24', lineHeight: 1.55 }}>
        ⚠️ Estimations basées sur vos saisies et le barème {cy} de l'impôt sur le revenu, fournies à titre indicatif. Consultez un conseiller fiscal pour votre situation réelle.
      </div>

      {/* ── 1. Profil fiscal ──────────────────────────────────────────────── */}
      <Section title="Profil fiscal" icon="🧾">
        <div className="of-grid">
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Revenu imposable annuel</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={0} max={300000} step={500} value={revenuImposable}
                onInput={e => setRevenuImposable(Number(e.target.value))}
                onChange={e => setRevenuImposable(Number(e.target.value))}
                style={{ flex: 1, cursor: 'pointer', touchAction: 'none' }} />
              <input type="number" min={0} value={revenuImposable} onChange={e => setRevenuImposable(Number(e.target.value) || 0)}
                style={{ ...inp, width: 100, textAlign: 'right' }} />
              <span style={{ fontSize: 11, color: T.textFaint }}>€</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Situation familiale</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: 'celibataire', l: 'Célibataire' }, { v: 'marie', l: 'Marié(e)' }, { v: 'pacse', l: 'Pacsé(e)' }].map(o => (
                <button key={o.v} onClick={() => handleSituation(o.v)}
                  style={{ background: situation === o.v ? T.accent + '22' : T.bg2, border: `1px solid ${situation === o.v ? T.accent : T.cardBorder}`, color: situation === o.v ? T.accent : T.textMuted, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Nombre de parts fiscales</div>
            <input type="number" min={1} step={0.5} value={nombreParts} onChange={e => setNombreParts(Number(e.target.value) || 1)}
              style={{ ...inp, width: 100 }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Tranche marginale d'imposition</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.accent }}>{tmi}%</div>
          </div>
        </div>
      </Section>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="of-kpis">
        <KPI T={T} icon="📊" label="TMI" value={`${tmi}%`} accent={T.accent} />
        <KPI T={T} icon="🏛️" label="Remplissage PEA" value={`${PEA_PLAFOND > 0 ? ((peaInvestedTotal / PEA_PLAFOND) * 100).toFixed(0) : 0}%`} sub={`${fEur(peaInvestedTotal)} / ${fEur(PEA_PLAFOND)}`} />
        <KPI T={T} icon="✨" label="Plus-values latentes" value={fEur(totalLatentPV)} accent={totalLatentPV >= 0 ? '#4ade80' : '#f87171'} />
        <KPI T={T} icon="💸" label="Dividendes reçus" value={fEur(divsTotalYear)} sub={`PFU estimé : ${fEur(pfuOnDividends)}`} />
      </div>

      {/* ── 2. Analyse des enveloppes ────────────────────────────────────────── */}
      <div className="of-grid">
        <Section title="PEA" icon={PORTFOLIO_TYPE_ICON.PEA} color={PORTFOLIO_TYPE_COLOR.PEA}>
          {peaEnvs.length === 0
            ? <Empty msg="Aucune enveloppe PEA détectée." />
            : peaEnvs.map(inv => <EnvelopeCard key={inv.id} inv={inv} typeKey="PEA" ageThreshold={5} ageLabel="Ancienneté fiscale" />)}
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
            Exonération d'impôt sur le revenu après 5 ans (seuls 17,2% de prélèvements sociaux restent dus). Plafond de versements : {fEur(PEA_PLAFOND)}.
          </div>
        </Section>

        <Section title="Assurance-vie" icon={PORTFOLIO_TYPE_ICON['Assurance-vie']} color={PORTFOLIO_TYPE_COLOR['Assurance-vie']}>
          {avEnvs.length === 0
            ? <Empty msg="Aucune enveloppe Assurance-vie détectée." />
            : avEnvs.map(inv => <EnvelopeCard key={inv.id} inv={inv} typeKey="Assurance-vie" ageThreshold={8} ageLabel="Ancienneté fiscale" />)}
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
            Abattement annuel de {fEur(AV_ABATTEMENT)} sur les gains rachetés après 8 ans (personne seule).
          </div>
        </Section>

        <Section title="CTO" icon={PORTFOLIO_TYPE_ICON.CTO} color={PORTFOLIO_TYPE_COLOR.CTO}>
          {ctoEnvs.length === 0
            ? <Empty msg="Aucune enveloppe CTO détectée." />
            : ctoEnvs.map(inv => (
              <div key={inv.id} style={{ background: T.bg2, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>{inv.name}</div>
                <Row label="Valeur actuelle" value={fEur(envValue(inv))} />
                <Row label="Capital investi" value={fEur(envInvested(inv))} />
              </div>
            ))}
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
            PFU de 30% sur dividendes et plus-values. {tmi < 30 ? 'Votre TMI est inférieure à 30% : l\'option barème progressif (abattement 40% sur dividendes) peut être plus avantageuse.' : 'Avec votre TMI actuelle, le PFU reste l\'option la plus avantageuse.'}
          </div>
        </Section>

        <Section title="PER" icon={PORTFOLIO_TYPE_ICON.PER} color={PORTFOLIO_TYPE_COLOR.PER}>
          {perEnvs.length === 0
            ? <Empty msg="Aucune enveloppe PER détectée." />
            : perEnvs.map(inv => (
              <div key={inv.id} style={{ background: T.bg2, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>{inv.name}</div>
                <Row label="Valeur actuelle" value={fEur(envValue(inv))} />
                <Row label="Capital investi (versements estimés)" value={fEur(envInvested(inv))} />
                <Row label="Économie d'impôt déjà réalisée (estimation)" value={fEur(envInvested(inv) * (tmi / 100))} color="#4ade80" />
              </div>
            ))}
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
            Plafond de versement déductible cette année : {fEur(Math.min(PER_PLAFOND_MAX, revenuImposable * 0.10))} (10% du revenu imposable, plafonné à {fEur(PER_PLAFOND_MAX)}).
            Économie d'impôt potentielle si versé en totalité : {fEur(Math.min(PER_PLAFOND_MAX, revenuImposable * 0.10) * (tmi / 100))}.
          </div>
        </Section>
      </div>

      {/* ── Répartition des enveloppes fiscales ──────────────────────────────── */}
      {pieData.length > 0 && (
        <Section title="Répartition des enveloppes fiscales" icon="📦">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
            <ResponsiveContainer width={220} height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => fEur(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 }}>
              {pieData.map(r => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.textMuted }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'inline-block' }} />{r.name}
                  </span>
                  <span style={{ fontWeight: 700, color: T.text }}>{fEur(r.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── 3. Plus-values latentes ──────────────────────────────────────────── */}
      <Section title="Plus-values latentes" icon="📈" color="#a78bfa">
        {allPositions.length === 0
          ? <Empty msg="Aucune position avec prix d'achat et prix actuel renseignés." />
          : (
            <div className="of-pv-grid">
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Top 5 plus-values</div>
                {topGains.length === 0
                  ? <Empty msg="Aucune position en plus-value." />
                  : topGains.map((r, i) => (
                    <Row key={i} label={`${r.label} (${r.envelope})`} value={fEur(r.pv)} color="#4ade80" bold />
                  ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Top 5 moins-values</div>
                {topLosses.length === 0
                  ? <Empty msg="Aucune position en moins-value." />
                  : topLosses.map((r, i) => (
                    <Row key={i} label={`${r.label} (${r.envelope})`} value={fEur(r.pv)} color="#f87171" bold />
                  ))}
              </div>
            </div>
          )}
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 12 }}>
          Impôt potentiel en cas de cession (PFU 30%) sur les positions en plus-value : {fEur(allPositions.filter(r => r.pv > 0).reduce((s, r) => s + r.taxIfSold, 0))}.
        </div>
      </Section>

      {/* ── 4. Recommandations personnalisées ────────────────────────────────── */}
      <Section title="Recommandations personnalisées" icon="💡">
        {recommendations.length === 0
          ? <Empty msg="Aucune recommandation particulière avec votre profil actuel — votre allocation fiscale semble déjà cohérente." />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendations.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.bg2, borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{r.text}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: PRIORITY_COLOR[r.priority] + '22', color: PRIORITY_COLOR[r.priority], flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {PRIORITY_LABEL[r.priority]}
                  </span>
                </div>
              ))}
            </div>
          )}
      </Section>

      {/* ── 5. Récap fiscal annuel ───────────────────────────────────────────── */}
      <Section title={`Récap fiscal ${cy}`} icon="📋" color="#60a5fa">
        <Row label="Dividendes reçus cette année" value={fEur(divsTotalYear)} bold />
        <Row label="PFU estimé sur dividendes (30%, sur brut)" value={fEur(pfuOnDividends)} color="#f87171" />
        <Row label="Plus-values réalisées sur biens vendus (matériel)" value={fEur(soldProfitThisYear)} />
        <Empty msg="Le suivi des cessions d'actions/ETF n'est pas encore disponible — les plus-values réalisées sur titres ne peuvent pas être calculées automatiquement." />
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 10, lineHeight: 1.6 }}>
          📝 Case 2DC (déclaration 2042) : dividendes et revenus assimilés ouvrant droit à abattement ≈ {fEur(divsGrossYear)}.
          Pour le détail complet (cessions, IFI, revenus fonciers), consultez la page « Récap fiscal ».
        </div>
      </Section>
    </div>
  );
}
