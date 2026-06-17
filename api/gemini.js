const { getCached, setCached } = require('./_cache');

const SYSTEM_PROMPT = `Tu es un conseiller financier personnel expert en patrimoine français. Tu analyses le portfolio de l'utilisateur de façon précise et personnalisée. Règles : réponds toujours en français, cite des chiffres concrets issus du portfolio (valeurs, pourcentages, rendements), donne des conseils actionnables et adaptés au profil, signale les risques réels détectés (concentration, liquidité, manque de diversification). Ne fais jamais de réponses génériques.

Tu es un conseiller financier français expert intégré à Capitaly. Analyse rigoureusement les données financières réelles fournies et donne des conseils précis avec les vrais chiffres exacts du JSON. Ne jamais inventer ni approximer des montants — utilise uniquement les valeurs reçues.

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

function isOffTopic(contents) {
  const lastUserMsg = [...contents].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return false;
  const text = (lastUserMsg.parts?.[0]?.text || '').toLowerCase();
  return OFF_TOPIC_KEYWORDS.some(kw => text.includes(kw));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-plan, x-user-id');

  try {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let AI_CONFIG;
    try {
      ({ AI_CONFIG } = await import('./_aiConfig.js'));
    } catch {
      AI_CONFIG = {
        model: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        limits: { free: 3, pro: 999 },
      };
    }

    const { contents, generationConfig, isAutoAnalysis } = req.body || {};
    if (!contents) return res.status(400).json({ error: 'Missing contents' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée' });

    const userPlan = req.headers['x-user-plan'] || 'free';
    const userId = req.headers['x-user-id'] || req.headers['x-forwarded-for'] || 'anon';

    // Rate limiting — skip for server-triggered auto-analysis
    if (!isAutoAnalysis && userPlan !== 'pro') {
      const date = new Date().toISOString().slice(0, 10);
      const cacheKey = `ai_count:${userId}:${date}`;
      const count = parseInt(await getCached(cacheKey) || '0', 10);
      if (count >= AI_CONFIG.limits.free) {
        return res.status(429).json({
          error: `Limite de ${AI_CONFIG.limits.free} questions par jour atteinte. Passez en Pro pour un accès illimité.`,
        });
      }
      await setCached(cacheKey, String(count + 1), 86400);
    }

    if (!isAutoAnalysis) {
      const lastUser = [...contents].reverse().find(m => m.role === 'user');
      if (lastUser) {
        const text = lastUser.parts?.[0]?.text || '';
        if (text.length > 500) {
          return res.status(400).json({ error: 'Message trop long (maximum 500 caractères).' });
        }
      }
      if (isOffTopic(contents)) {
        return res.status(200).json({
          candidates: [{ content: { parts: [{ text: OFF_TOPIC_REPLY }] } }],
        });
      }
    }

    const url = `${AI_CONFIG.baseUrl}/${AI_CONFIG.model}:generateContent?key=${apiKey}`;
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: generationConfig?.temperature ?? 0.7,
          maxOutputTokens: generationConfig?.maxOutputTokens ?? 2048,
        },
      }),
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      console.error('[gemini] API error:', apiRes.status, JSON.stringify(data));
      return res.status(502).json({ error: data.error?.message || `Erreur Gemini ${apiRes.status}` });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[gemini] exception non gérée:', err.message, err.stack);
    return res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
};
