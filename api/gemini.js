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

  console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
  console.log('OPENROUTER_API_KEY prefix:', process.env.OPENROUTER_API_KEY?.substring(0, 10));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents, generationConfig } = req.body || {};
  if (!contents) return res.status(400).json({ error: 'Missing contents' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY non configurée' });

  const models = ['qwen/qwen3-235b-a22b:free', 'nvidia/nemotron-nano-9b-v2:free', 'openai/gpt-oss-20b:free'];
  const messages = toMessages(contents);
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
          messages,
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
};
