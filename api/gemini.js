const { GoogleAuth } = require('google-auth-library');

const MODELS = ['gemini-2.0-flash-exp', 'gemini-1.5-pro-latest'];

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      project_id: process.env.GOOGLE_PROJECT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents, generationConfig } = req.body || {};
  if (!contents) return res.status(400).json({ error: 'Missing contents' });

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return res.status(500).json({ error: `Authentification Google échouée : ${err.message}` });
  }

  let lastError;
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let apiRes;
    try {
      apiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
