const { yfGetWithFallback } = require('./_priceUtils');

const THEGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/realtoken-thegraph/realtokens-gnosis';

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── The Graph subgraph → wallet balances + tokenPrice ────────────────────────
async function fetchTheGraph(addr) {
  const query = `{ accounts(where:{address:"${addr}"}) { balances(where:{amount_gt:"0"}) { amount token { address name symbol tokenPrice annualPercentageYield netRentYearPerToken } } } }`;
  try {
    const res = await fetch(THEGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 300);
    console.log(`[realt-wallet] TheGraph → HTTP ${res.status} | ${bodySnippet}`);

    if (!res.ok) return { balances: [], status: res.status, ok: false, bodySnippet };

    let data;
    try { data = JSON.parse(text); } catch {
      return { balances: [], status: res.status, ok: false, bodySnippet };
    }

    const balances = data?.data?.accounts?.[0]?.balances || [];
    console.log(`[realt-wallet] TheGraph: ${balances.length} balances`);
    return { balances, status: res.status, ok: true, bodySnippet, count: balances.length };
  } catch (e) {
    console.error(`[realt-wallet] TheGraph threw: ${e.message}`);
    return { balances: [], status: 0, ok: false, bodySnippet: e.message };
  }
}

function balanceToToken(balance, eurusd) {
  const token = balance.token || {};
  const amount = parseFloat(balance.amount || '0') / 1e18;
  if (amount <= 0) return null;

  const priceUSD = parseFloat(token.tokenPrice || '0');
  if (priceUSD <= 0) return null;

  const priceEUR = priceUSD / eurusd;

  return {
    symbol:          token.symbol || 'REALT',
    name:            token.name   || 'RealT Token',
    contractAddress: (token.address || '').toLowerCase(),
    amount,
    priceUSD:        parseFloat(priceUSD.toFixed(4)),
    priceEUR:        parseFloat(priceEUR.toFixed(2)),
    totalUSD:        parseFloat((amount * priceUSD).toFixed(2)),
    totalEUR:        parseFloat((amount * priceEUR).toFixed(2)),
    annualYield:     token.annualPercentageYield ? parseFloat(token.annualPercentageYield) : null,
  };
}

// ── Blockscout fallback → ERC-20 balances + exchange_rate ────────────────────
async function fetchBlockscout(addr) {
  const url = `https://gnosis.blockscout.com/api/v2/addresses/${addr}/token-balances`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const bodySnippet = text.slice(0, 300);
    console.log(`[realt-wallet] Blockscout fallback → HTTP ${res.status} | ${bodySnippet}`);

    if (!res.ok) return { items: [], status: res.status, ok: false, bodySnippet };

    let data;
    try { data = JSON.parse(text); } catch {
      return { items: [], status: res.status, ok: false, bodySnippet };
    }

    const raw = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    const items = raw.filter(item => {
      if (item?.token?.type && !/ERC-?20/i.test(item.token.type)) return false;
      const name = item?.token?.name || '';
      const sym  = item?.token?.symbol || '';
      return /realtoken/i.test(name) || /realtoken/i.test(sym);
    });

    console.log(`[realt-wallet] Blockscout fallback: ${raw.length} ERC-20, ${items.length} RealT`);
    return { items, rawCount: raw.length, status: res.status, ok: true, bodySnippet };
  } catch (e) {
    console.error(`[realt-wallet] Blockscout threw: ${e.message}`);
    return { items: [], status: 0, ok: false, bodySnippet: e.message };
  }
}

function blockscoutItemToToken(item, eurusd) {
  const token    = item.token || {};
  const decimals = parseInt(token.decimals, 10) || 18;
  const amount   = parseFloat(item.value || '0') / Math.pow(10, decimals);
  if (amount <= 0) return null;

  const contractAddress = (token.address || token.address_hash || '').toLowerCase();
  const priceUSD = parseFloat(token.exchange_rate || '0');
  if (priceUSD <= 0) return null;

  const priceEUR = priceUSD / eurusd;
  return {
    symbol:          token.symbol || 'REALT',
    name:            token.name   || 'RealT Token',
    contractAddress,
    amount,
    priceUSD:        parseFloat(priceUSD.toFixed(4)),
    priceEUR:        parseFloat(priceEUR.toFixed(2)),
    totalUSD:        parseFloat((amount * priceUSD).toFixed(2)),
    totalEUR:        parseFloat((amount * priceEUR).toFixed(2)),
    annualYield:     null,
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
    const [graphResult, eurusd] = await Promise.all([fetchTheGraph(addr), getEURUSD()]);

    let tokens = [];
    let source = 'thegraph';
    let fallbackResult = null;

    if (graphResult.ok && graphResult.balances.length > 0) {
      tokens = graphResult.balances.map(b => balanceToToken(b, eurusd)).filter(Boolean);
    }

    if (tokens.length === 0) {
      source = 'blockscout';
      fallbackResult = await fetchBlockscout(addr);
      tokens = fallbackResult.items.map(item => blockscoutItemToToken(item, eurusd)).filter(Boolean);
    }

    const debug = {
      address: addr,
      source,
      thegraph: {
        status:      graphResult.status,
        ok:          graphResult.ok,
        balances:    graphResult.balances.length,
        withPrice:   source === 'thegraph' ? tokens.length : undefined,
        bodySnippet: graphResult.bodySnippet,
      },
      blockscout: fallbackResult ? {
        status:       fallbackResult.status,
        ok:           fallbackResult.ok,
        rawERC20:     fallbackResult.rawCount ?? 0,
        realtFound:   fallbackResult.items?.length ?? 0,
        withPrice:    tokens.length,
        bodySnippet:  fallbackResult.bodySnippet,
      } : null,
      eurusd,
    };

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Aucun token RealT trouvé pour cette adresse', debug });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens via ${source}`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length, debug });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
