// GET /api/crypto-wallet?address=0x...&network=ethereum|bsc|polygon|arbitrum|optimism|gnosis|all
const { yfGetWithFallback } = require('./_priceUtils');
const { getCached, setCached } = require('./_cache');

const NETWORKS = {
  ethereum: { host: 'eth.blockscout.com',      nativeSymbol: 'ETH',  nativeName: 'Ethereum' },
  bsc:      { host: 'bsc.blockscout.com',      nativeSymbol: 'BNB',  nativeName: 'BNB' },
  polygon:  { host: 'polygon.blockscout.com',  nativeSymbol: 'POL',  nativeName: 'Polygon' },
  arbitrum: { host: 'arbitrum.blockscout.com', nativeSymbol: 'ETH',  nativeName: 'Ethereum' },
  optimism: { host: 'optimism.blockscout.com', nativeSymbol: 'ETH',  nativeName: 'Ethereum' },
  gnosis:   { host: 'gnosis.blockscout.com',   nativeSymbol: 'XDAI', nativeName: 'xDAI' },
};

async function getEURUSD() {
  try {
    const data = await yfGetWithFallback('/v8/finance/chart/EURUSD=X?interval=1d&range=1d');
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1.08;
  } catch { return 1.08; }
}

async function fetchNetworkData(networkKey, address) {
  const net = NETWORKS[networkKey];
  const cacheKey = `cwallet:${networkKey}:${address}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const [tokensRes, addrRes] = await Promise.allSettled([
    fetch(`https://${net.host}/api/v2/addresses/${address}/token-balances`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(12000),
    }),
    fetch(`https://${net.host}/api/v2/addresses/${address}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Capitaly/1.0' },
      signal: AbortSignal.timeout(12000),
    }),
  ]);

  const result = { networkKey, rawTokens: [], nativeRaw: null };

  if (tokensRes.status === 'fulfilled' && tokensRes.value.ok) {
    try {
      const data = await tokensRes.value.json();
      result.rawTokens = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    } catch {}
  }

  if (addrRes.status === 'fulfilled' && addrRes.value.ok) {
    try {
      const data = await addrRes.value.json();
      result.nativeRaw = { coin_balance: data.coin_balance, exchange_rate: data.exchange_rate };
    } catch {}
  }

  await setCached(cacheKey, result, 300);
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address, network = 'ethereum' } = req.query;
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    return res.status(400).json({ error: 'Adresse wallet invalide (format : 0x + 40 hex)' });
  }
  const addr = address.toLowerCase();

  const networkKeys = network === 'all'
    ? Object.keys(NETWORKS)
    : network.split(',').map(n => n.trim()).filter(n => NETWORKS[n]);

  if (!networkKeys.length) {
    return res.status(400).json({ error: `Réseau inconnu : ${network}` });
  }

  try {
    const eurusd = await getEURUSD();
    const settled = await Promise.allSettled(networkKeys.map(nk => fetchNetworkData(nk, addr)));

    const allTokens = [];
    const nativeBalances = [];
    const networksFound = [];

    for (let i = 0; i < networkKeys.length; i++) {
      if (settled[i].status !== 'fulfilled') continue;
      const { networkKey: nk, rawTokens, nativeRaw } = settled[i].value;
      const net = NETWORKS[nk];

      for (const item of rawTokens) {
        const token = item.token || {};
        if (token.type && !/ERC-?20/i.test(token.type)) continue;
        const decimals = parseInt(token.decimals, 10) || 18;
        const amount = parseFloat(item.value || '0') / Math.pow(10, decimals);
        if (amount <= 0) continue;
        const sym = (token.symbol || '').toUpperCase();
        const STABLECOINS = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'LUSD', 'CRVUSD', 'EURC', 'USDE', 'PYUSD'];
        const rawRate = parseFloat(token.exchange_rate);
        const priceUSD = rawRate > 0 ? rawRate : (STABLECOINS.includes(sym) ? 1.0 : 0);
        if (priceUSD <= 0) continue;
        const priceEUR = priceUSD / eurusd;
        allTokens.push({
          symbol: token.symbol || '?',
          name: token.name || token.symbol || '?',
          contractAddress: (token.address || token.address_hash || '').toLowerCase(),
          amount: parseFloat(amount.toFixed(8)),
          priceUSD: parseFloat(priceUSD.toFixed(4)),
          priceEUR: parseFloat(priceEUR.toFixed(2)),
          totalUSD: parseFloat((amount * priceUSD).toFixed(2)),
          totalEUR: parseFloat((amount * priceEUR).toFixed(2)),
          iconUrl: token.icon_url || null,
          network: nk,
        });
        if (!networksFound.includes(nk)) networksFound.push(nk);
      }

      if (nativeRaw?.coin_balance) {
        const nativeAmount = parseFloat(nativeRaw.coin_balance) / 1e18;
        if (nativeAmount > 0.000001) {
          const nativePriceUSD = parseFloat(nativeRaw.exchange_rate || '0');
          const nativePriceEUR = nativePriceUSD > 0 ? nativePriceUSD / eurusd : 0;
          nativeBalances.push({
            network: nk,
            symbol: net.nativeSymbol,
            name: net.nativeName,
            amount: parseFloat(nativeAmount.toFixed(8)),
            priceUSD: parseFloat(nativePriceUSD.toFixed(2)),
            priceEUR: parseFloat(nativePriceEUR.toFixed(2)),
            totalUSD: parseFloat((nativeAmount * nativePriceUSD).toFixed(2)),
            totalEUR: parseFloat((nativeAmount * nativePriceEUR).toFixed(2)),
          });
          if (!networksFound.includes(nk)) networksFound.push(nk);
        }
      }
    }

    allTokens.sort((a, b) => b.totalEUR - a.totalEUR);

    const totalEUR = parseFloat(
      (allTokens.reduce((s, t) => s + t.totalEUR, 0) + nativeBalances.reduce((s, n) => s + n.totalEUR, 0)).toFixed(2)
    );

    if (allTokens.length === 0 && nativeBalances.length === 0) {
      return res.status(404).json({ error: 'Aucun token avec prix trouvé pour cette adresse sur les réseaux sélectionnés' });
    }

    console.log(`[crypto-wallet] ${addr}: ${allTokens.length} tokens + ${nativeBalances.length} native on [${networksFound.join(',')}]`);
    return res.json({ tokens: allTokens, nativeBalances, totalEUR, count: allTokens.length, networks: networksFound, eurusd: parseFloat(eurusd.toFixed(4)) });
  } catch (err) {
    console.error('[crypto-wallet] fatal:', err.message);
    return res.status(502).json({ error: err.message });
  }
};
