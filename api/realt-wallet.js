const { yfGetWithFallback } = require('./_priceUtils');

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    return res.status(400).json({ error: 'Adresse wallet invalide (format : 0x + 40 hex)' });
  }

  try {
    const [holderRes, eurusd] = await Promise.all([
      fetch(`https://api.realtoken.community/v1/holder/${address.toLowerCase()}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
        signal: AbortSignal.timeout(10000),
      }),
      getEURUSD(),
    ]);

    if (!holderRes.ok) throw new Error(`RealToken API: HTTP ${holderRes.status}`);
    const raw = await holderRes.json();

    // Normalize: handle [{amount, token}] or {holder:{balances:[...]}} shapes
    const balances = Array.isArray(raw)
      ? raw
      : raw?.holder?.balances || raw?.balances || [];

    const tokens = balances
      .map(b => {
        const token = b.token || {};
        const amount = parseFloat(b.amount) || 0;
        if (amount <= 0) return null;
        const priceUSD = parseFloat(token.tokenPrice) || 0;
        const priceEUR = priceUSD > 0 ? priceUSD / eurusd : 0;
        if (priceEUR <= 0) return null;
        return {
          symbol:      token.shortName || token.symbol || 'REALT',
          name:        token.fullName  || token.name  || token.shortName || token.symbol || 'RealT Token',
          amount,
          priceUSD,
          priceEUR:    parseFloat(priceEUR.toFixed(2)),
          totalUSD:    parseFloat((amount * priceUSD).toFixed(2)),
          totalEUR:    parseFloat((amount * priceEUR).toFixed(2)),
          annualYield: parseFloat(token.annualPercentageYield || 0),
        };
      })
      .filter(Boolean);

    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length });
  } catch (err) {
    console.error('[realt-wallet]', err.message);
    res.status(502).json({ error: err.message });
  }
};
