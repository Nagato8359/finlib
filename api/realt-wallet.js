const { yfGetWithFallback } = require('./_priceUtils');

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
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
// exchange_rate is the CoinGecko USD price embedded by Blockscout
function itemToToken(item, eurusd) {
  const token    = item.token || {};
  const decimals = parseInt(token.decimals, 10) || 18;
  const amount   = parseFloat(item.value || '0') / Math.pow(10, decimals);
  if (amount <= 0) return null;

  // address field: v2 uses "address", older versions used "address_hash"
  const contractAddress = (token.address || token.address_hash || '').toLowerCase();

  const priceUSD = parseFloat(token.exchange_rate || '0');
  if (priceUSD <= 0) return null; // skip tokens Blockscout has no price for

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
    const [blockscout, eurusd] = await Promise.all([
      fetchBlockscout(addr),
      getEURUSD(),
    ]);

    const tokens = blockscout.items
      .map(item => itemToToken(item, eurusd))
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
