import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation';

async function callGemini(contents, isAutoAnalysis = false, userPlan = 'free', userId = 'anon') {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-plan': userPlan, 'x-user-id': userId },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }, isAutoAnalysis }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur API (${res.status})`);
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function buildContext(data) {
  const r   = n => Math.round(+(n) || 0);
  const p1  = n => parseFloat((+(n) || 0).toFixed(1));
  const total = data.patrimoine || 0;

  // ── Investissements ─────────────────────────────────────────────────────────
  const investissements = (data.investments || []).map(inv => {
    const lv = data.invLiveValue ? data.invLiveValue(inv) : (parseFloat(inv.value) || 0);
    const li = data.invLiveInvested ? data.invLiveInvested(inv) : (parseFloat(inv.invested) || 0);
    const pv = lv - li;
    const positions = (inv.positions || []).map(p => {
      const prix = (data.prices?.[p.isin?.toUpperCase() || p.ticker?.toUpperCase()]) ?? p.currentPrice ?? 0;
      const pru  = parseFloat(p.buyPrice) || 0;
      return {
        nom:      p.name || p.ticker || p.isin || '',
        ticker:   p.ticker || p.isin || '',
        quantite: +(p.shares) || 0,
        pru,
        prix:     +parseFloat(prix).toFixed(2),
        valeur:   r((p.shares || 0) * prix),
        pv_pct:   pru > 0 ? p1(((prix - pru) / pru) * 100) : 0,
      };
    });
    const obj = {
      nom:     inv.name,
      type:    inv.type || 'Autre',
      valeur:  r(lv),
      investi: r(li),
      pv:      r(pv),
      pv_pct:  li > 0 ? p1((pv / li) * 100) : 0,
    };
    if (positions.length) obj.positions = positions;
    return obj;
  });

  // ── Épargne ─────────────────────────────────────────────────────────────────
  const savingsArr = data.savings || data.computedSavings || [];
  const epargne = savingsArr.map(s => {
    const solde = parseFloat(s.balance ?? s.amount) || 0;
    const taux  = parseFloat(s.rate) || 0;
    return {
      nom:              s.name,
      type:             s.type || '',
      solde:            r(solde),
      taux,
      interets_annuels: r(solde * taux / 100),
    };
  });

  // ── Flux du mois ─────────────────────────────────────────────────────────────
  const revenus  = r(data.income);
  const depenses = r(data.expense);
  const catMap   = {};
  (data.catData || [])
    .sort((a, b) => b.value - a.value)
    .forEach(c => { catMap[c.name] = r(c.value); });
  const flux_mois = {
    revenus,
    depenses,
    epargne_nette: revenus - depenses,
    taux_epargne:  p1(data.savingsRate),
    par_categorie: catMap,
  };

  // ── Budgets (seulement si dépassements ou données non vides) ─────────────────
  const budgets = {};
  Object.entries(data.budgetProgress || {}).forEach(([cat, p]) => {
    budgets[cat] = {
      depense: r(p.spent),
      limite:  r(p.limit),
      pct:     p.limit > 0 ? r((p.spent / p.limit) * 100) : null,
      depasse: !!(p.limit > 0 && p.spent > p.limit),
    };
  });

  // ── Dettes ───────────────────────────────────────────────────────────────────
  const loans = data.computedLoans || data.loans || [];
  const debts = data.debts || [];
  const dettes = [
    ...loans.map(l => ({
      nom:              l.name || l.label || 'Crédit',
      capital_restant:  r(l.computedRemaining ?? l.capitalRemaining ?? l.remaining ?? 0),
      mensualite:       r((parseFloat(l.monthlyPayment) || 0) + (parseFloat(l.insuranceAmount) || 0)),
      taux:             parseFloat(l.rate) || 0,
    })),
    ...debts.map(d => ({
      nom:             d.name || d.label || 'Dette',
      capital_restant: r(parseFloat(d.capitalRemaining) || 0),
      mensualite:      r(parseFloat(d.monthlyPayment) || 0),
      taux:            parseFloat(d.rate) || 0,
    })),
  ];

  // ── Objectifs ────────────────────────────────────────────────────────────────
  const objectifs = (data.goals || []).map(g => ({
    nom:            g.name,
    cible:          r(g.target),
    progression_pct: g.target > 0 ? r((total / g.target) * 100) : 0,
    echeance:       g.deadline || null,
  }));

  // ── Matériel / Actifs physiques ──────────────────────────────────────────────
  const materiel = (data.healthAssets || []).map(h => ({
    nom:             h.name,
    categorie:       h.category,
    prix_achat:      r(h.buyPrice),
    valeur_actuelle: r(h.currentValue),
    pv:              r(h.currentValue - h.buyPrice),
    pv_pct:          h.buyPrice > 0 ? p1((h.currentValue - h.buyPrice) / h.buyPrice * 100) : 0,
    etat:            h.condition,
  }));

  // ── Ventes en cours ──────────────────────────────────────────────────────────
  const ventes_en_cours = (data.listings || []).map(l => ({
    nom:                 l.name,
    prix_achat:          r(l.buyPrice),
    prix_vente_souhaite: r(l.sellPrice),
    frais:               r(l.fees),
    benefice_potentiel:  r(l.sellPrice - l.buyPrice - l.fees),
    plateforme:          l.platform,
    jours_en_vente:      Math.floor((new Date() - new Date(l.listedDate)) / 86400000),
  }));

  // ── Ventes réalisées ─────────────────────────────────────────────────────────
  const ventes_realisees = (data.soldHistory || []).map(s => ({
    nom:          s.name,
    benefice_net: r(s.salePrice - s.buyPrice - s.fees),
  }));

  // ── Contexte final ────────────────────────────────────────────────────────────
  const ctx = {
    patrimoine: {
      total:           r(total),
      investissements: r(data.invTotal),
      epargne:         r(data.cashTotal),
      materiel:        r(data.healthTotal),
    },
    investissements,
    epargne,
    flux_mois,
    ...(Object.keys(budgets).length ? { budgets } : {}),
    ...(dettes.length ? { dettes } : {}),
    ...(objectifs.length ? { objectifs } : {}),
    ...(materiel.length ? { materiel } : {}),
    ...(ventes_en_cours.length ? { ventes_en_cours } : {}),
    ...(ventes_realisees.length ? { ventes_realisees } : {}),
    score_sante:      data.score || 0,
    taux_endettement: p1(data.endettementRate),
  };

  return JSON.stringify(ctx);
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function boldToHtml(escaped) {
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function MdText({ text, T }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 14, lineHeight: 1.65, color: T.textMuted }}>
      {text.split('\n').map((line, i) => {
        const headMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^\*\*([^*]+)\*\*\s*$/);
        if (headMatch) {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 15, color: T.text, marginTop: 14, marginBottom: 4 }}>
              {headMatch[1].replace(/\*\*/g, '')}
            </div>
          );
        }
        if (/^[-•*]\s/.test(line)) {
          const html = boldToHtml(escHtml(line.replace(/^[-•*]\s/, '')));
          return (
            <div key={i} style={{ paddingLeft: 14, marginBottom: 4, display: 'flex', gap: 7 }}>
              <span style={{ color: T.accent, flexShrink: 0, marginTop: 1 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
        return (
          <div key={i} style={{ marginBottom: 3 }}
            dangerouslySetInnerHTML={{ __html: boldToHtml(escHtml(line)) }} />
        );
      })}
    </div>
  );
}

const ANALYSIS_PROMPT = ctx => `Tu es un conseiller en gestion de patrimoine senior, franc, précis et dynamique. Tu analyses la situation financière complète ci-dessous et rédiges un rapport personnalisé en français.

DONNÉES FINANCIÈRES :
${ctx}

STYLE :
- Ton professionnel mais vivant — pas de langue de bois, pas de formules creuses
- Commence DIRECTEMENT par les points forts, sans introduction ni bonjour
- Chaque point doit citer un chiffre réel tiré des données (jamais de généralités)
- Identifie les vraies opportunités et les vrais risques, pas les évidences
- Sois direct sur ce qui ne va pas, bienveillant sur ce qui va bien
- Utilise des comparaisons concrètes quand c'est utile (ex: "votre taux d'épargne de 49% est 3x la moyenne française de 17%")

STRUCTURE OBLIGATOIRE (5 sections, dans cet ordre) :

💪 **CE QUI FONCTIONNE BIEN**
3 points forts réels avec chiffres précis et mise en contexte (pourquoi c'est bien, quelle opportunité ça crée).

⚠️ **CE QUI MÉRITE ATTENTION**
3 points de vigilance concrets avec impact chiffré et risque réel identifié (concentration, liquidité, fiscalité, endettement).

💡 **OPTIMISATIONS CONCRÈTES**
3 actions précises avec économie ou gain estimé en euros. Ex: "Vos factures dépassent de 38€/mois votre budget — sur 12 mois c'est 456€ récupérables."

📈 **STRATÉGIE D'INVESTISSEMENT**
Analyse la diversification réelle du portefeuille (% par classe d'actif), identifie les déséquilibres, propose des ajustements adaptés au profil avec montants concrets.

🎯 **3 ACTIONS PRIORITAIRES — 90 JOURS**
3 actions classées par priorité et impact, avec délai et résultat attendu chiffré. Format : Action → Pourquoi maintenant → Impact estimé.`;

const SUGGESTIONS = [
  "Comment améliorer mon taux d'épargne ?",
  "Où placer mon épargne disponible ?",
  "Mon niveau d'endettement est-il raisonnable ?",
  "Analyse mes dépenses par catégorie",
  "Comment optimiser mon PEA ?",
  "Quelle est ma progression vers l'indépendance financière ?",
];

export default function IATab({ T, data }) {
  const { t } = useTranslation();
  const isPro = true; // TODO: connecter à subscriptions Stripe
  const userPlan = isPro ? 'pro' : 'free';
  const userId = data?.user?.id || data?.userId || 'anon';
  const [analysisState, setAnalysisState] = useState('loading'); // loading | done | error
  const [analysis, setAnalysis] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { runAnalysis(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  async function runAnalysis() {
    setAnalysisState('loading');
    setAnalysisError('');
    try {
      const text = await callGemini([{ role: 'user', parts: [{ text: ANALYSIS_PROMPT(buildContext(data)) }] }], true, userPlan, userId);
      setAnalysis(text);
      setAnalysisState('done');
    } catch (err) {
      setAnalysisError(err.message);
      setAnalysisState('error');
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || chatLoading) return;
    setInput('');
    const next = [...messages, { role: 'user', text: q }];
    setMessages(next);
    setChatLoading(true);
    try {
      const freshCtx = buildContext(data);
      const sys = `Tu es l'assistant financier expert de Capitaly. Tu réponds UNIQUEMENT EN FRANÇAIS, de façon concise et personnalisée (200 mots maximum par réponse).\n\nVoici la situation financière complète de l'utilisateur :\n${freshCtx}\nUtilise ces chiffres réels dans tes réponses quand c'est pertinent. Sois bienveillant, précis et actionnable.`;
      const contents = [
        { role: 'user', parts: [{ text: sys }] },
        { role: 'model', parts: [{ text: "Compris, je suis votre assistant financier Capitaly. Comment puis-je vous aider ?" }] },
        ...next.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      ];
      const reply = await callGemini(contents, false, userPlan, userId);
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `❌ Erreur : ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ textAlign: 'center', paddingBottom: 2 }}>
        <div style={{ fontSize: 38 }}>🤖</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: T.text, letterSpacing: '-.03em', marginTop: 6 }}>Capitaly IA</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>{t('ia_subtitle')}</div>
      </div>

      {/* Analysis card */}
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{t('ia_analysis_title')}</span>
          {analysisState === 'done' && (
            <button onClick={runAnalysis}
              style={{ background: T.accent + '1a', border: `1px solid ${T.accent}40`, borderRadius: 8, color: T.accent, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('ia_refresh')}
            </button>
          )}
        </div>

        {analysisState === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 16 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.cardBorder}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ fontSize: 14, color: T.textMuted }}>{t('ia_loading')}</div>
          </div>
        )}

        {analysisState === 'error' && (
          <div style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>❌ {analysisError}</div>
            <button onClick={runAnalysis}
              style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, color: '#f87171', padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('ia_retry')}
            </button>
          </div>
        )}

        {analysisState === 'done' && <MdText text={analysis} T={T} />}
      </div>

      {/* Chat card — shown even on error so user can still ask questions */}
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{t('ia_chat_title')}</span>

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setInput(s)}
                style={{ background: 'transparent', border: `1px solid ${T.cardBorder}`, borderRadius: 20, color: T.textMuted, padding: '6px 13px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.cardBorder}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? `linear-gradient(135deg,${T.accent},${T.accentDark})` : T.bg,
                  border: m.role === 'user' ? 'none' : `1px solid ${T.cardBorder}`,
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '10px 14px', fontSize: 14,
                  color: m.role === 'user' ? '#fff' : T.text,
                  lineHeight: 1.55, whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
          <input
            value={input} onChange={e => setInput(e.target.value)}
            placeholder={t('ia_placeholder')}
            style={{ flex: 1, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, color: T.text, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <button type="submit" disabled={!input.trim() || chatLoading}
            style={{ background: `linear-gradient(135deg,${T.accent},${T.accentDark})`, border: 'none', borderRadius: 12, color: '#fff', padding: '10px 20px', fontSize: 16, cursor: (!input.trim() || chatLoading) ? 'not-allowed' : 'pointer', opacity: (!input.trim() || chatLoading) ? 0.5 : 1, fontFamily: 'inherit', transition: 'opacity .15s' }}>
            ↗
          </button>
        </form>
      </div>

      {/* Disclaimer */}
      <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#fbbf24', lineHeight: 1.55 }}>
        {t('ia_disclaimer')}
      </div>
    </div>
  );
}
