const { yfGetWithFallback } = require('./_priceUtils');

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

// ── Ethereum mainnet (community REST API) ─────────────────────────────────────
const MAINNET_ENDPOINTS = [
  addr => `https://api.realtoken.community/v1/holder/${addr}`,
  addr => `https://api.realtoken.community/v1/holders/${addr}`,
  addr => `https://api.realtoken.community/v1/wallet/${addr}`,
  addr => `https://realt-data.netlify.app/api/holder/${addr}`,
];

async function fetchMainnet(addr) {
  for (const mkUrl of MAINNET_ENDPOINTS) {
    const url = mkUrl(addr);
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[realt-wallet] ${url} → HTTP ${res.status}`);
      if (res.status === 404) continue;
      if (!res.ok) { console.error(`[realt-wallet] ${url} error ${res.status}`); continue; }
      const raw = await res.json();
      const balances = Array.isArray(raw) ? raw : raw?.holder?.balances || raw?.balances || [];
      if (balances.length > 0) return balances;
    } catch (e) {
      console.error(`[realt-wallet] ${url} threw: ${e.message}`);
    }
  }
  return [];
}

// ── Gnosis Chain ──────────────────────────────────────────────────────────────
const THEGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/realtoken-thegraph/realtokens-gnosis';

async function fetchGnosis(addr) {
  // 1. TheGraph Gnosis subgraph — provides amounts + prices in one query
  const query = `{accounts(where:{address:"${addr}"}){balances(where:{amount_gt:"0"}){amount token{address name symbol tokenPrice annualPercentageYield}}}}`;
  try {
    const res = await fetch(THEGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(12000),
    });
    console.log(`[realt-wallet] TheGraph Gnosis → HTTP ${res.status}`);
    if (res.ok) {
      const json = await res.json();
      const balances = json?.data?.accounts?.[0]?.balances || [];
      if (balances.length > 0) {
        console.log(`[realt-wallet] TheGraph Gnosis: ${balances.length} balances`);
        return balances;
      }
    }
  } catch (e) {
    console.error(`[realt-wallet] TheGraph Gnosis threw: ${e.message}`);
  }

  // 2. Community API with explicit network param
  try {
    const url = `https://api.realtoken.community/v1/holder/${addr}?network=gnosis`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[realt-wallet] community?network=gnosis → HTTP ${res.status}`);
    if (res.ok) {
      const raw = await res.json();
      const balances = Array.isArray(raw) ? raw : raw?.holder?.balances || raw?.balances || [];
      if (balances.length > 0) return balances;
    }
  } catch (e) {
    console.error(`[realt-wallet] community?network=gnosis threw: ${e.message}`);
  }

  // 3. GnosisScan token list (amounts only — usable only when prices come from mainnet)
  try {
    const url = `https://api.gnosisscan.io/api?module=account&action=tokenlist&address=${addr}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[realt-wallet] GnosisScan → HTTP ${res.status}`);
    if (res.ok) {
      const json = await res.json();
      const items = (json?.result || []).filter(
        t => /realtoken/i.test(t.name || '') || /REALTOKEN/i.test(t.symbol || '')
      );
      if (items.length > 0) {
        // Normalize to {amount, token} shape; tokenPrice will be 0 (no price source here)
        return items.map(t => ({
          amount: String(parseFloat(t.balance) / Math.pow(10, parseInt(t.decimals, 10) || 18)),
          token: { symbol: t.symbol, name: t.name, tokenPrice: '0', annualPercentageYield: '0' },
        }));
      }
    }
  } catch (e) {
    console.error(`[realt-wallet] GnosisScan threw: ${e.message}`);
  }

  return [];
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
    const [mainnetBalances, gnosisBalances, eurusd] = await Promise.all([
      fetchMainnet(addr),
      fetchGnosis(addr),
      getEURUSD(),
    ]);

    // Merge gnosis first (priority), then mainnet — deduplicate by symbol
    const seen = new Set();
    const merged = [...gnosisBalances, ...mainnetBalances].filter(b => {
      const sym = (b.token?.shortName || b.token?.symbol || '').toUpperCase();
      if (!sym || seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });

    const tokens = merged.map(b => normalizeBalance(b, eurusd)).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(404).json({
        error: "Aucun token RealT trouvé pour cette adresse — vérifiez que l'adresse est correcte et contient des tokens RealT",
      });
    }

    console.log(`[realt-wallet] ${addr}: ${tokens.length} tokens (mainnet: ${mainnetBalances.length}, gnosis: ${gnosisBalances.length})`);
    res.json({ tokens, eurusd: parseFloat(eurusd.toFixed(4)), count: tokens.length });
  } catch (err) {
    console.error('[realt-wallet] fatal:', err.message);
    res.status(502).json({ error: err.message });
  }
};
