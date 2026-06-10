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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents, generationConfig } = req.body || {};
  if (!contents) return res.status(400).json({ error: 'Missing contents' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY non configurée' });

  const body = {
    model: 'google/gemini-2.0-flash-exp:free',
    messages: toMessages(contents),
    temperature: generationConfig?.temperature ?? 0.7,
    max_tokens: generationConfig?.maxOutputTokens ?? 2048,
  };

  let apiRes;
  try {
    apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://finlib-six.vercel.app',
        'X-Title': 'Capitaly',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  const data = await apiRes.json().catch(() => ({}));
  if (!apiRes.ok) {
    return res.status(apiRes.status).json({ error: data.error?.message || `Erreur OpenRouter (${apiRes.status})` });
  }

  // Re-shape to Gemini response format so the frontend needs no changes
  const text = data.choices?.[0]?.message?.content ?? '';
  return res.status(200).json({
    candidates: [{ content: { parts: [{ text }] } }],
  });
};
