const { yfGetWithFallback } = require('./_priceUtils');

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── Community /v1/realtokens → full list with prices ─────────────────────────
async function fetchRealTokensList() {
  try {
    const res = await fetch('https://api.realtoken.community/v1/realtokens', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    console.log(`[realt-wallet] community /realtokens → HTTP ${res.status} | ${text.slice(0, 200)}`);
    if (!res.ok) return { byContract: {}, status: res.status };
    let list = [];
    try { list = JSON.parse(text); } catch { return { byContract: {}, status: res.status }; }
    if (!Array.isArray(list)) return { byContract: {}, status: res.status };

    // Index by contract address (lowercase) for fast O(1) lookup
    const byContract = {};
    for (const t of list) {
      for (const field of ['xDaiContract', 'gnosisContract', 'ethereumContract']) {
        const addr = t[field];
        if (addr && typeof addr === 'string') byContract[addr.toLowerCase()] = t;
      }
    }
    console.log(`[realt-wallet] community /realtokens: ${list.length} tokens indexed`);
    return { byContract, status: res.status };
  } catch (e) {
    console.error(`[realt-wallet] community /realtokens threw: ${e.message}`);
    return { byContract: {}, error: e.message };
  }
}

// ── Blockscout Gnosis → ERC20 balances for wallet ────────────────────────────
async function fetchBlockscout(addr) {
  const url = `https://gnosis.blockscout.com/api/v2/addresses/${addr}/token-balances`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 400);
    console.log(`[realt-wallet] Blockscout Gnosis → HTTP ${res.status} | ${bodySnippet}`);
    if (!res.ok) return { items: [], status: res.status, ok: false, bodySnippet };

    let data = null;
    try { data = JSON.parse(text); } catch {
      return { items: [], status: res.status, ok: false, bodySnippet };
    }

    // Response is array or { items: [...] }
    const raw = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);

    // Keep only RealT ERC-20 tokens
    const items = raw.filter(item => {
      if (item?.token?.type && !/ERC-?20/i.test(item.token.type)) return false;
      const name = item?.token?.name || '';
      const sym  = item?.token?.symbol || '';
      return /realtoken/i.test(name) || /realtoken/i.test(sym);
    });

    console.log(`[realt-wallet] Blockscout: ${raw.length} ERC-20 tokens, ${items.length} RealT`);
    return { items, rawCount: raw.length, status: res.status, ok: true, bodySnippet };
  } catch (e) {
    console.error(`[realt-wallet] Blockscout threw: ${e.message}`);
    return { items: [], status: 0, ok: false, error: e.message };
  }
}

// Blockscout item + community token data → normalized balance shape
function blockscoutToBalance(item, communityToken) {
  const decimals = parseInt(item.token?.decimals, 10) || 18;
  const amount   = parseFloat(item.value || '0') / Math.pow(10, decimals);
  return {
    amount: String(amount),
    contractAddress: (item.token?.address || '').toLowerCase(),
    token: {
      shortName:            communityToken?.shortName            || item.token?.symbol || '',
      fullName:             communityToken?.fullName             || item.token?.name   || '',
      symbol:               item.token?.symbol || '',
      name:                 item.token?.name   || '',
      tokenPrice:           String(communityToken?.tokenPrice           ?? 0),
      annualPercentageYield: String(communityToken?.annualPercentageYield ?? 0),
    },
  };
}

// ── Ethereum mainnet fallback (community REST API) ────────────────────────────
async function fetchMainnet(addr) {
  const endpoints = [
    { label: 'community /holder',  url: `https://api.realtoken.community/v1/holder/${addr}` },
    { label: 'community /holders', url: `https://api.realtoken.community/v1/holders/${addr}` },
    { label: 'community /wallet',  url: `https://api.realtoken.community/v1/wallet/${addr}` },
  ];
  const attempts = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      const bodySnippet = text.slice(0, 300);
      console.log(`[realt-wallet] ${ep.label} → HTTP ${res.status} | ${bodySnippet}`);
      let raw = null;
      try { raw = JSON.parse(text); } catch { /* not JSON */ }
      const balances = Array.isArray(raw) ? raw
        : Array.isArray(raw?.holder?.balances) ? raw.holder.balances
        : Array.isArray(raw?.balances) ? raw.balances
        : [];
      attempts.push({ label: ep.label, url: ep.url, status: res.status, ok: res.ok, balancesFound: balances.length, bodySnippet });
      if (res.ok && balances.length > 0) return { balances, attempts };
    } catch (e) {
      console.error(`[realt-wallet] ${ep.label} threw: ${e.message}`);
      attempts.push({ label: ep.label, url: ep.url, status: 0, ok: false, balancesFound: 0, error: e.message });
    }
  }
  return { balances: [], attempts };
}

// ── Normalize to output shape ─────────────────────────────────────────────────
function normalizeBalance(b, eurusd) {
  const token  = b.token || {};
  const amount = parseFloat(b.amount) || 0;
  if (amount <= 0) return null;
  const priceUSD = parseFloat(token.tokenPrice) || 0;
  const priceEUR = priceUSD > 0 ? priceUSD / eurusd : 0;
  if (priceEUR <= 0) return null;
  return {
    symbol:      token.shortName || token.symbol || 'REALT',
    name:        token.fullName  || token.name   || token.shortName || token.symbol || 'RealT Token',
    amount,
    priceUSD,
    priceEUR:     parseFloat(priceEUR.toFixed(2)),
    totalUSD:     parseFloat((amount * priceUSD).toFixed(2)),
    totalEUR:     parseFloat((amount * priceEUR).toFixed(2)),
    annualYield:  parseFloat(token.annualPercentageYield || 0),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
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
    // Run all sources in parallel
    const [blockscout, realTokensData, mainnetResult, eurusd] = await Promise.all([
      fetchBlockscout(addr),
      fetchRealTokensList(),
      fetchMainnet(addr),
      getEURUSD(),
    ]);

    // ── Gnosis: enrich Blockscout tokens with prices from community list ──
    const gnosisBalances = blockscout.items.map(item => {
      const contractAddr  = (item.token?.address || '').toLowerCase();
      const communityToken = realTokensData.byContract?.[contractAddr];
      return blockscoutToBalance(item, communityToken);
    });

    // ── Merge: gnosis first (priority), then mainnet — deduplicate by symbol ──
    const seen = new Set();
    const merged = [...gnosisBalances, ...mainnetResult.balances].filter(b => {
      const sym = (b.token?.shortName || b.token?.symbol || '').toUpperCase();
      if (!sym || seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });

    const tokens = merged.map(b => normalizeBalance(b, eurusd)).filter(Boolean);

    const debug = {
      address: addr,
      blockscout:  { status: blockscout.status, ok: blockscout.ok, realtTokensFound: blockscout.items?.length ?? 0, rawERC20Count: blockscout.rawCount ?? 0, bodySnippet: blockscout.bodySnippet, error: blockscout.error },
      realtTokens: { status: realTokensData.status, indexed: Object.keys(realTokensData.byContract ?? {}).length, error: realTokensData.error },
      mainnet:     mainnetResult.attempts,
      gnosisBalancesRaw: gnosisBalances.length,
      mainnetBalancesRaw: mainnetResult.balances.length,
      mergedAfterDedup: merged.length,
      tokensWithPrice: tokens.length,
    };

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Aucun token RealT trouvé pour cette adresse', debug });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens (gnosis: ${gnosisBalances.length}, mainnet: ${mainnetResult.balances.length})`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length, debug });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
