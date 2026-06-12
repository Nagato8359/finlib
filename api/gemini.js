const SYSTEM_PROMPT = `Tu es un conseiller financier français expert intégré à Capitaly. Analyse rigoureusement les données financières réelles fournies et donne des conseils précis avec les vrais chiffres exacts du JSON. Ne jamais inventer ni approximer des montants — utilise uniquement les valeurs reçues.

Sections du JSON à analyser si présentes : investments (PEA, CTO, crypto, SCPI, assurance-vie, etc.), savings (Livret A, LDD, PER, etc.), health_assets (véhicules, collections, objets de valeur), loans et debts, goals (objectifs financiers), listings (articles en vente), sold_history (historique des cessions).

Points à couvrir systématiquement lorsque les données le permettent :
- Patrimoine total = investissements + épargne + actifs matériels (avec plus/moins-values)
- Actifs matériels (véhicules, collections) : valeur courante vs coût d'achat, plus-value ou moins-value latente
- Articles en vente (listings) : bénéfice potentiel sur chaque article
- Fiscalité française : PEA (exonération des PV après 5 ans), crypto (flat tax 30%), PV mobilières hors PEA (30%), revenus locatifs (IR ou micro-foncier), plus-values immobilières
- Plafonds réglementaires : PEA 150 000 €, Livret A 22 950 €, LDD 12 000 €, PER déductible, assurance-vie abattement 152 500 €
- Alertes si un plafond est dépassé ou proche d'être atteint

Tu réponds UNIQUEMENT aux questions concernant les finances personnelles, l'épargne, les investissements, le budget, les dettes, le patrimoine et la fiscalité. Si l'utilisateur pose une question hors de ces sujets, réponds : "Je suis spécialisé uniquement dans les finances personnelles. Je ne peux pas répondre à cette question. Posez-moi une question sur votre patrimoine, vos investissements ou votre budget."`;

const OFF_TOPIC_KEYWORDS = [
  'recette', 'cuisine', 'cuisinier', 'ingrédient', 'plat', 'repas', 'nourriture',
  'sport', 'football', 'tennis', 'match', 'équipe', 'joueur',
  'film', 'cinéma', 'série', 'acteur', 'réalisateur',
  'musique', 'chanson', 'artiste', 'album', 'concert',
  'jeu', 'jeux vidéo', 'gaming', 'console',
  'météo', 'temps', 'température',
  'politique', 'élection', 'président',
  'blague', 'histoire drôle', 'humour',
  'poème', 'roman', 'littérature',
];

const OFF_TOPIC_REPLY = "Je suis spécialisé uniquement dans les finances personnelles. Je ne peux pas répondre à cette question. Posez-moi une question sur votre patrimoine, vos investissements ou votre budget.";

function isOffTopic(messages) {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return false;
  const text = lastUserMsg.content.toLowerCase();
  return OFF_TOPIC_KEYWORDS.some(kw => text.includes(kw));
}

// Converts Gemini-format contents to OpenAI-compatible messages for OpenRouter
function toMessages(contents) {
  return contents.map(({ role, parts }) => ({
    role: role === 'model' ? 'assistant' : role,
    content: parts.map(p => p.text).join(''),
  }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
  console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
  console.log('OPENROUTER_API_KEY prefix:', process.env.OPENROUTER_API_KEY?.substring(0, 10));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents, generationConfig, isAutoAnalysis } = req.body || {};
  if (!contents) return res.status(400).json({ error: 'Missing contents' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY non configurée' });

  const messages = toMessages(contents);

  if (!isAutoAnalysis) {
    // Validation longueur sur les messages chat manuels
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser && lastUser.content.length > 500) {
      return res.status(400).json({ error: 'Message trop long (maximum 500 caractères).' });
    }

    // Garde-fou hors-sujet — réponse directe sans appel API
    if (isOffTopic(messages)) {
      return res.status(200).json({
        candidates: [{ content: { parts: [{ text: OFF_TOPIC_REPLY }] } }],
      });
    }
  }

  // Injection du prompt système en tête de conversation
  const messagesWithSystem = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  const models = ['qwen/qwen3-235b-a22b:free', 'nvidia/nemotron-nano-9b-v2:free', 'openai/gpt-oss-20b:free'];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://finlib-six.vercel.app',
    'X-Title': 'Capitaly',
  };

  let apiRes, data, lastError;
  for (const model of models) {
    try {
      apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: messagesWithSystem,
          temperature: generationConfig?.temperature ?? 0.7,
          max_tokens: generationConfig?.maxOutputTokens ?? 2048,
        }),
      });
    } catch (err) {
      console.error(`[gemini] fetch error (${model}):`, err.message);
      lastError = err.message;
      continue;
    }
    data = await apiRes.json().catch(() => ({}));
    if (apiRes.ok) break;
    console.error(`[gemini] ${model} → HTTP ${apiRes.status}`, JSON.stringify(data));
    lastError = data.error?.message || `Erreur OpenRouter ${apiRes.status} (${model})`;
    apiRes = null;
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!apiRes?.ok) {
    console.error('[gemini] tous les modèles ont échoué. Dernière erreur :', lastError);
    return res.status(502).json({ error: lastError });
  }

  // Re-shape to Gemini response format so the frontend needs no changes
  const text = data.choices?.[0]?.message?.content ?? '';
  return res.status(200).json({
    candidates: [{ content: { parts: [{ text }] } }],
  });

  } catch (err) {
    console.error('[gemini] exception non gérée:', err.message, err.stack);
    return res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
};
