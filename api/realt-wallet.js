const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── RealT token list → tokenPrice index ──────────────────────────────────────
const REALT_LIST_URLS = [
  'https://raw.githubusercontent.com/real-token/realt-tokens-list/main/tokens/xdai.json',
  'https://raw.githubusercontent.com/real-token/realt-tokens-list/main/src/tokens/xdai.json',
  'https://api.realtoken.community/v1/realtokens',
];

async function fetchGitHubTokenList() {
  const cacheKey = 'realt:tokenlist:xdai:v2';
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  let lastDebug = { url: null, status: null, bodySnippet: null };

  for (const url of REALT_LIST_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      lastDebug = { url, status: res.status, bodySnippet: text.slice(0, 200) };
      console.log(`[realt-wallet] token list ${url} → HTTP ${res.status} | ${text.slice(0, 100)}`);

      if (!res.ok) continue;

      let list;
      try { list = JSON.parse(text); } catch { continue; }

      const tokens = Array.isArray(list) ? list : (list?.tokens || []);
      if (!tokens.length) continue;

      const index = {};
      for (const t of tokens) {
        const addr = (t.xDaiContract || t.gnosisContract || t.address || '').toLowerCase();
        if (addr && addr !== '0x' && addr.length === 42) index[addr] = t;
      }

      if (Object.keys(index).length === 0) continue;

      console.log(`[realt-wallet] token list: ${Object.keys(index).length} indexed from ${url}`);
      const result = { index, debug: { url, status: res.status, bodySnippet: text.slice(0, 200) } };
      await setCached(cacheKey, result, 3600);
      return result;
    } catch (e) {
      lastDebug = { url, status: 0, bodySnippet: e.message };
      console.error(`[realt-wallet] token list ${url} threw: ${e.message}`);
    }
  }

  // All URLs failed — return empty, do NOT cache so next request retries
  console.error('[realt-wallet] all token list URLs failed');
  return { index: {}, debug: lastDebug };
}

// ── Blockscout Gnosis → ERC-20 balances + exchange_rate ──────────────────────
async function fetchBlockscout(addr) {
  const url = `https://gnosis.blockscout.com/api/v2/addresses/${addr}/token-balances`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 500);
    console.log(`[realt-wallet] Blockscout → HTTP ${res.status} | ${bodySnippet}`);

    if (!res.ok) return { items: [], status: res.status, ok: false, bodySnippet };

    let data = null;
    try { data = JSON.parse(text); } catch {
      return { items: [], status: res.status, ok: false, bodySnippet };
    }

    // v2 response: array or { items: [...] }
    const raw = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);

    // Keep only ERC-20 RealT tokens
    const items = raw.filter(item => {
      if (item?.token?.type && !/ERC-?20/i.test(item.token.type)) return false;
      const name = item?.token?.name || '';
      const sym  = item?.token?.symbol || '';
      return /realtoken/i.test(name) || /realtoken/i.test(sym);
    });

    console.log(`[realt-wallet] Blockscout: ${raw.length} ERC-20, ${items.length} RealT`);
    return { items, rawCount: raw.length, status: res.status, ok: true, bodySnippet };
  } catch (e) {
    console.error(`[realt-wallet] Blockscout threw: ${e.message}`);
    return { items: [], status: 0, ok: false, error: e.message };
  }
}

// Convert one Blockscout token-balance entry to output token shape
// Priority: GitHub tokenPrice → Blockscout exchange_rate → skip
function itemToToken(item, eurusd, githubIndex) {
  const token    = item.token || {};
  const decimals = parseInt(token.decimals, 10) || 18;
  const amount   = parseFloat(item.value || '0') / Math.pow(10, decimals);
  if (amount <= 0) return null;

  const contractAddress = (token.address || token.address_hash || '').toLowerCase();

  const githubEntry = githubIndex[contractAddress];
  const priceUSD = parseFloat(githubEntry?.tokenPrice || token.exchange_rate || '0');
  if (priceUSD <= 0) return null;

  const priceEUR = priceUSD / eurusd;
  const annualYield = githubEntry?.annualPercentageYield
    ? parseFloat(githubEntry.annualPercentageYield)
    : null;

  return {
    symbol:          token.symbol || 'REALT',
    name:            githubEntry?.fullName || token.name || 'RealT Token',
    contractAddress,
    amount,
    priceUSD:        parseFloat(priceUSD.toFixed(4)),
    priceEUR:        parseFloat(priceEUR.toFixed(2)),
    totalUSD:        parseFloat((amount * priceUSD).toFixed(2)),
    totalEUR:        parseFloat((amount * priceEUR).toFixed(2)),
    annualYield,
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
    const [blockscout, eurusd, tokenListResult] = await Promise.all([
      fetchBlockscout(addr),
      getEURUSD(),
      fetchGitHubTokenList(),
    ]);

    const { index: githubIndex, debug: tokenListDebug } = tokenListResult;

    const tokens = blockscout.items
      .map(item => itemToToken(item, eurusd, githubIndex))
      .filter(Boolean);

    const debug = {
      address: addr,
      blockscout: {
        status:         blockscout.status,
        ok:             blockscout.ok,
        rawERC20Count:  blockscout.rawCount ?? 0,
        realtFound:     blockscout.items?.length ?? 0,
        withPrice:      tokens.length,
        bodySnippet:    blockscout.bodySnippet,
        error:          blockscout.error,
      },
      tokenList: {
        size:        Object.keys(githubIndex).length,
        url:         tokenListDebug?.url,
        status:      tokenListDebug?.status,
        bodySnippet: tokenListDebug?.bodySnippet,
      },
      eurusd,
    };

    if (tokens.length === 0) {
      return res.status(404).json({
        error: 'Aucun token RealT trouvé pour cette adresse',
        debug,
      });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens via Blockscout`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length, debug });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
