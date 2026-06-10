import { useState, useEffect, useRef } from 'react';

async function callGemini(contents) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur API (${res.status})`);
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function fmtEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function buildContext(data) {
  const pct = n => `${(+(n || 0)).toFixed(1)}%`;
  const sign = n => (n >= 0 ? '+' : '') + fmtEur(n);
  let c = '';

  // Patrimoine global avec répartition en %
  const total = data.patrimoine || 0;
  const invPct  = total > 0 ? ((data.invTotal   / total) * 100).toFixed(0) : 0;
  const cashPct = total > 0 ? ((data.cashTotal  / total) * 100).toFixed(0) : 0;
  const matPct  = total > 0 ? ((data.healthTotal / total) * 100).toFixed(0) : 0;
  c += `═══ PATRIMOINE TOTAL : ${fmtEur(total)} ═══\n`;
  c += `  • Investissements financiers : ${fmtEur(data.invTotal)} (${invPct}%)\n`;
  c += `  • Épargne & liquidités       : ${fmtEur(data.cashTotal)} (${cashPct}%)\n`;
  c += `  • Patrimoine matériel        : ${fmtEur(data.healthTotal)} (${matPct}%)\n`;
  c += `  • Plus-value latente totale  : ${sign(data.pnlTotal || 0)}\n\n`;

  // Investissements — détail par enveloppe
  if (data.investments?.length) {
    c += `INVESTISSEMENTS — ${data.investments.length} enveloppe(s) :\n`;
    c += `  Investi : ${fmtEur(data.invInvested)} | Valeur actuelle : ${fmtEur(data.invTotal)} | PnL : ${sign(data.pnlTotal || 0)}\n`;
    data.investments.forEach(inv => {
      const val      = inv.currentValue ?? inv.value ?? 0;
      const invested = inv.invested ?? inv.cost ?? inv.buyPrice ?? null;
      const pnlInv   = invested != null ? val - invested : null;
      let line = `  - ${inv.name} (${inv.type ?? 'N/A'}) : ${fmtEur(val)}`;
      if (invested != null) line += ` | investi : ${fmtEur(invested)} | PnL : ${sign(pnlInv)}`;
      c += line + '\n';
    });
    c += '\n';
  }

  // Épargne — détail par compte
  if (data.savings?.length) {
    c += `COMPTES ÉPARGNE — ${data.savings.length} compte(s) :\n`;
    data.savings.forEach(s => {
      const bal = s.balance ?? s.amount ?? 0;
      const annual = bal * ((s.rate || 0) / 100);
      c += `  - ${s.name} : ${fmtEur(bal)} à ${s.rate}%/an (≈ ${fmtEur(annual)} d'intérêts/an)\n`;
    });
    c += `  Total épargne : ${fmtEur(data.cashTotal)}\n\n`;
  }

  // Actifs matériels — détail
  if (data.healthAssets?.length) {
    c += `ACTIFS MATÉRIELS — ${data.healthAssets.length} actif(s) :\n`;
    data.healthAssets.forEach(a => {
      const val  = a.value ?? a.estimatedValue ?? 0;
      const cost = a.cost ?? a.purchasePrice ?? 0;
      c += `  - ${a.name} (${a.type ?? 'N/A'}) : valeur ${fmtEur(val)} | acheté ${fmtEur(cost)} | ${sign(val - cost)}\n`;
    });
    c += '\n';
  }

  // Revenus & dépenses du mois
  c += `FINANCES DU MOIS EN COURS :\n`;
  c += `  • Revenus   : ${fmtEur(data.income)}\n`;
  c += `  • Dépenses  : ${fmtEur(data.expense)}\n`;
  c += `  • Solde     : ${fmtEur(data.balance)}\n`;
  c += `  • Taux d'épargne         : ${pct(data.savingsRate)}\n`;
  c += `  • Score santé financière : ${data.score}/100\n\n`;

  // Dépenses par catégorie triées par montant
  if (data.catData?.length) {
    c += `DÉPENSES PAR CATÉGORIE :\n`;
    [...data.catData].sort((a, b) => b.value - a.value).forEach(cat => {
      const share = data.expense > 0 ? ((cat.value / data.expense) * 100).toFixed(0) : 0;
      c += `  - ${cat.name} : ${fmtEur(cat.value)} (${share}% des dépenses)\n`;
    });
    c += '\n';
  }

  // Budget mensuel avec alertes dépassement
  if (data.budgetProgress && Object.keys(data.budgetProgress).length) {
    c += `BUDGET MENSUEL :\n`;
    Object.entries(data.budgetProgress).forEach(([cat, p]) => {
      const used   = p.limit > 0 ? ((p.spent / p.limit) * 100).toFixed(0) : '?';
      const alert  = p.limit > 0 && p.spent > p.limit ? ' ⚠ DÉPASSÉ' : '';
      c += `  - ${cat} : ${fmtEur(p.spent)} / ${fmtEur(p.limit)} (${used}%)${alert}\n`;
    });
    c += '\n';
  }

  // Dettes & crédits — détail
  if (data.totalDebt > 0) {
    c += `DETTES ET CRÉDITS :\n`;
    c += `  Total dû : ${fmtEur(data.totalDebt)} | Mensualités : ${fmtEur(data.monthlyDebtPayments)} | Taux d'endettement : ${pct(data.endettementRate)}\n`;
    data.loans?.forEach(l => {
      const remaining = l.remaining ?? l.capital ?? l.amount ?? 0;
      const monthly   = l.monthly ?? l.monthlyPayment ?? 0;
      c += `  - Prêt "${l.name ?? l.label ?? 'N/A'}" : capital restant ${fmtEur(remaining)}, mensualité ${fmtEur(monthly)}${l.rate ? `, taux ${l.rate}%` : ''}\n`;
    });
    data.debts?.forEach(d => {
      c += `  - Dette "${d.name ?? d.label ?? 'N/A'}" : ${fmtEur(d.amount ?? d.balance ?? 0)}${d.rate ? ` à ${d.rate}%` : ''}\n`;
    });
    c += '\n';
  }

  // Objectifs financiers
  if (data.goals?.length) {
    c += `OBJECTIFS FINANCIERS :\n`;
    data.goals.forEach(g => {
      const progress  = g.target > 0 ? ((g.current / g.target) * 100).toFixed(1) : 0;
      const remaining = (g.target ?? 0) - (g.current ?? 0);
      c += `  - ${g.name} : ${fmtEur(g.current)} / ${fmtEur(g.target)} (${progress}% — reste ${fmtEur(remaining)})\n`;
    });
    c += '\n';
  }

  // Ventes en cours
  const activeListings = data.listings?.filter(l => !l.sold) ?? [];
  if (activeListings.length) {
    c += `VENTES EN COURS :\n`;
    activeListings.forEach(l => {
      const profit = (l.sellPrice ?? 0) - (l.buyPrice ?? 0);
      c += `  - ${l.name} : demandé ${fmtEur(l.sellPrice)}, acheté ${fmtEur(l.buyPrice)}, bénéfice potentiel ${sign(profit)}\n`;
    });
    c += '\n';
  }

  return c;
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
              <span style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }}>•</span>
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

const ANALYSIS_PROMPT = ctx => `Tu es un conseiller financier expert francophone. Analyse la situation financière complète ci-dessous et rédige un rapport personnalisé UNIQUEMENT EN FRANÇAIS.

DONNÉES FINANCIÈRES COMPLÈTES DE L'UTILISATEUR :
${ctx}
CONSIGNES :
- Réponds EXCLUSIVEMENT en français
- Cite des chiffres précis tirés des données (montants, pourcentages, ratios)
- Sois concret, bienveillant et actionnable
- Structure ta réponse avec exactement ces 5 sections dans cet ordre :

💪 **POINTS FORTS**
2-3 points positifs du profil avec chiffres à l'appui.

⚠️ **POINTS D'AMÉLIORATION**
2-3 domaines prioritaires à corriger avec chiffres et impact concret.

💡 **CONSEILS SUR LES DÉPENSES**
Analyse les postes de dépenses les plus importants et propose 2-3 optimisations concrètes avec économies estimées.

📈 **RÉPARTITION DES INVESTISSEMENTS**
Évalue la diversification du portefeuille (classes d'actifs, concentration) et propose des ajustements adaptés au profil.

🔮 **PROJECTION ET RECOMMANDATIONS**
3 actions prioritaires à réaliser dans les 3 prochains mois, avec impact financier estimé pour chacune.`;

const SUGGESTIONS = [
  "Comment améliorer mon taux d'épargne ?",
  'Où placer mon épargne disponible ?',
  "Mon niveau d'endettement est-il raisonnable ?",
  'Analyse mes dépenses par catégorie',
];

export default function IATab({ T, data }) {
  const [analysisState, setAnalysisState] = useState('loading'); // loading | done | error
  const [analysis, setAnalysis] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const ctx = useRef(buildContext(data));

  useEffect(() => { runAnalysis(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  async function runAnalysis() {
    setAnalysisState('loading');
    setAnalysisError('');
    try {
      console.log('=== CONTEXTE ENVOYÉ À L\'IA ===', ctx.current);
      const text = await callGemini([{ role: 'user', parts: [{ text: ANALYSIS_PROMPT(ctx.current) }] }]);
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
      const sys = `Tu es l'assistant financier expert de Capitaly. Tu réponds UNIQUEMENT EN FRANÇAIS, de façon concise et personnalisée (200 mots maximum par réponse).\n\nVoici la situation financière complète de l'utilisateur :\n${ctx.current}\nUtilise ces chiffres réels dans tes réponses quand c'est pertinent. Sois bienveillant, précis et actionnable.`;
      const contents = [
        { role: 'user', parts: [{ text: sys }] },
        { role: 'model', parts: [{ text: "Compris, je suis votre assistant financier Capitaly. Comment puis-je vous aider ?" }] },
        ...next.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      ];
      const reply = await callGemini(contents);
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
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Analyse intelligente de votre patrimoine</div>
      </div>

      {/* Analysis card */}
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>📊 Analyse de votre patrimoine</span>
          {analysisState === 'done' && (
            <button onClick={runAnalysis}
              style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, color: '#10b981', padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ↻ Actualiser
            </button>
          )}
        </div>

        {analysisState === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 16 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.cardBorder}`, borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ fontSize: 14, color: T.textMuted }}>Capitaly IA analyse votre patrimoine…</div>
          </div>
        )}

        {analysisState === 'error' && (
          <div style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>❌ {analysisError}</div>
            <button onClick={runAnalysis}
              style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, color: '#f87171', padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Réessayer
            </button>
          </div>
        )}

        {analysisState === 'done' && <MdText text={analysis} T={T} />}
      </div>

      {/* Chat card — shown even on error so user can still ask questions */}
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>💬 Posez une question</span>

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setInput(s)}
                style={{ background: 'transparent', border: `1px solid ${T.cardBorder}`, borderRadius: 20, color: T.textMuted, padding: '6px 13px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
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
                  background: m.role === 'user' ? 'linear-gradient(135deg,#10b981,#059669)' : T.bg,
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
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
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
            placeholder="Posez une question sur vos finances…"
            style={{ flex: 1, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, color: T.text, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <button type="submit" disabled={!input.trim() || chatLoading}
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 12, color: '#fff', padding: '10px 20px', fontSize: 16, cursor: (!input.trim() || chatLoading) ? 'not-allowed' : 'pointer', opacity: (!input.trim() || chatLoading) ? 0.5 : 1, fontFamily: 'inherit', transition: 'opacity .15s' }}>
            ↗
          </button>
        </form>
      </div>

      {/* Disclaimer */}
      <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#fbbf24', lineHeight: 1.55 }}>
        ⚠️ Capitaly IA fournit des informations à titre éducatif uniquement. Ceci ne constitue pas un conseil en investissement. Consultez un conseiller financier agréé pour toute décision importante.
      </div>
    </div>
  );
}
