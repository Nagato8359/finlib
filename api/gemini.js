const MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro-latest'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents, generationConfig } = req.body || {};
  if (!contents) return res.status(400).json({ error: 'Missing contents' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée' });

  let lastError;
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let apiRes;
    try {
      apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig }),
      });
    } catch (err) {
      lastError = err.message;
      continue;
    }

    if (apiRes.ok) {
      const data = await apiRes.json();
      return res.status(200).json(data);
    }

    const errBody = await apiRes.json().catch(() => ({}));
    lastError = errBody.error?.message || `Erreur Gemini ${apiRes.status} (${model})`;
  }

  return res.status(502).json({ error: lastError });
};
