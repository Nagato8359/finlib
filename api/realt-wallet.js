const { yfGetWithFallback } = require('./_priceUtils');

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// Fetch one URL, log everything, return { status, raw, balances, bodySnippet }
async function probe(label, url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0', ...(options.headers || {}) },
      signal: AbortSignal.timeout(12000),
      ...options,
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 400);
    console.log(`[realt-wallet] ${label} → HTTP ${res.status} | ${bodySnippet}`);

    let raw = null;
    try { raw = JSON.parse(text); } catch { /* not JSON */ }

    const balances = raw
      ? Array.isArray(raw) ? raw : raw?.holder?.balances || raw?.balances || []
      : [];

    return { label, url, status: res.status, ok: res.ok, raw, balances, bodySnippet };
  } catch (e) {
    console.error(`[realt-wallet] ${label} threw: ${e.message}`);
    return { label, url, status: 0, ok: false, raw: null, balances: [], error: e.message };
  }
}

// ── Ethereum mainnet (community REST API) ─────────────────────────────────────
async function fetchMainnet(addr) {
  const endpoints = [
    { label: 'community /holder',  url: `https://api.realtoken.community/v1/holder/${addr}` },
    { label: 'community /holders', url: `https://api.realtoken.community/v1/holders/${addr}` },
    { label: 'community /wallet',  url: `https://api.realtoken.community/v1/wallet/${addr}` },
    { label: 'netlify fallback',   url: `https://realt-data.netlify.app/api/holder/${addr}` },
  ];
  const attempts = [];
  for (const ep of endpoints) {
    const r = await probe(ep.label, ep.url);
    attempts.push(r);
    if (r.ok && r.balances.length > 0) return { balances: r.balances, attempts };
  }
  return { balances: [], attempts };
}

// ── Gnosis Chain ──────────────────────────────────────────────────────────────
const THEGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/realtoken-thegraph/realtokens-gnosis';

async function fetchGnosis(addr) {
  const attempts = [];

  // 1. TheGraph Gnosis subgraph
  const query = `{accounts(where:{address:"${addr}"}){balances(where:{amount_gt:"0"}){amount token{address name symbol tokenPrice annualPercentageYield}}}}`;
  try {
    const res = await fetch(THEGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 400);
    console.log(`[realt-wallet] TheGraph Gnosis → HTTP ${res.status} | ${bodySnippet}`);
    let raw = null;
    try { raw = JSON.parse(text); } catch { /* not JSON */ }
    const balances = raw?.data?.accounts?.[0]?.balances || [];
    attempts.push({ label: 'TheGraph Gnosis', url: THEGRAPH_URL, status: res.status, ok: res.ok, balances, bodySnippet });
    if (res.ok && balances.length > 0) {
      console.log(`[realt-wallet] TheGraph Gnosis: ${balances.length} balances`);
      return { balances, attempts };
    }
  } catch (e) {
    console.error(`[realt-wallet] TheGraph Gnosis threw: ${e.message}`);
    attempts.push({ label: 'TheGraph Gnosis', url: THEGRAPH_URL, status: 0, ok: false, balances: [], error: e.message });
  }

  // 2. Community API with ?network=xdai (xDai = Gnosis Chain original name)
  const r2 = await probe('community ?network=xdai', `https://api.realtoken.community/v1/holder/${addr}?network=xdai`);
  attempts.push(r2);
  if (r2.ok && r2.balances.length > 0) return { balances: r2.balances, attempts };

  // 3. Community API with ?network=gnosis
  const r3 = await probe('community ?network=gnosis', `https://api.realtoken.community/v1/holder/${addr}?network=gnosis`);
  attempts.push(r3);
  if (r3.ok && r3.balances.length > 0) return { balances: r3.balances, attempts };

  // 4. Community alternative (ehpst portal)
  const r4 = await probe('ehpst portal', `https://ehpst.duckdns.org/realt_portal/api/wallet/${addr}`);
  attempts.push(r4);
  if (r4.ok && r4.balances.length > 0) return { balances: r4.balances, attempts };

  // 5. GnosisScan token list (amounts only)
  const r5 = await probe('GnosisScan tokenlist', `https://api.gnosisscan.io/api?module=account&action=tokenlist&address=${addr}`);
  attempts.push(r5);
  if (r5.ok && r5.raw?.result) {
    const items = (r5.raw.result || []).filter(
      t => /realtoken/i.test(t.name || '') || /realtoken/i.test(t.symbol || '')
    );
    if (items.length > 0) {
      const balances = items.map(t => ({
        amount: String(parseFloat(t.balance) / Math.pow(10, parseInt(t.decimals, 10) || 18)),
        token: { symbol: t.symbol, name: t.name, tokenPrice: '0', annualPercentageYield: '0' },
      }));
      return { balances, attempts };
    }
  }

  return { balances: [], attempts };
}

// ── Normalize a balance entry to output shape ─────────────────────────────────
function normalizeBalance(b, eurusd) {
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
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    return res.status(400).json({ error: 'Adresse wallet invalide (format : 0x + 40 hex)' });
  }

  const addr = address.toLowerCase();

  try {
    const [mainnetResult, gnosisResult, eurusd] = await Promise.all([
      fetchMainnet(addr),
      fetchGnosis(addr),
      getEURUSD(),
    ]);

    const allAttempts = [
      ...mainnetResult.attempts.map(a => ({ chain: 'mainnet', ...a })),
      ...gnosisResult.attempts.map(a => ({ chain: 'gnosis', ...a })),
    ];

    // Merge gnosis first (priority), then mainnet — deduplicate by symbol
    const seen = new Set();
    const merged = [...gnosisResult.balances, ...mainnetResult.balances].filter(b => {
      const sym = (b.token?.shortName || b.token?.symbol || '').toUpperCase();
      if (!sym || seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });

    const tokens = merged.map(b => normalizeBalance(b, eurusd)).filter(Boolean);

    if (tokens.length === 0) {
      // Always return debug info so the client can diagnose
      return res.status(404).json({
        error: "Aucun token RealT trouvé pour cette adresse",
        debug: {
          address: addr,
          mainnetRaw: mainnetResult.balances.length,
          gnosisRaw: gnosisResult.balances.length,
          attempts: allAttempts.map(a => ({
            chain: a.chain, label: a.label, status: a.status, ok: a.ok,
            balancesFound: a.balances?.length ?? 0,
            bodySnippet: a.bodySnippet,
            error: a.error,
          })),
        },
      });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens (mainnet: ${mainnetResult.balances.length}, gnosis: ${gnosisResult.balances.length})`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
