const { getCached, setCached } = require('./_cache');

const ETAT_MULT = { renover: 0.75, bon: 1.0, renove: 1.12, neuf: 1.22 };
const OPTION_BONUS = { parking: 0.03, jardin: 0.05, cave: 0.02, ascenseur: 0.02 };
const TYPE_LOCAL_MAP = { appartement: 'Appartement', maison: 'Maison', immeuble: 'Immeuble' };

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function filterAndComputeMedian(mutations, typeLocal, refLat, refLon, radiusKm) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);

  const matched = [];
  let latestDate = null;

  for (const m of mutations) {
    if (m.nature_mutation !== 'Vente') continue;
    if (m.type_local !== typeLocal) continue;
    const surface = parseFloat(m.surface_reelle_bati);
    const valeur = parseFloat(m.valeur_fonciere);
    if (!surface || !valeur || surface < 9) continue;
    const dateVente = new Date(m.date_mutation);
    if (isNaN(dateVente) || dateVente < cutoff) continue;

    if (radiusKm !== null) {
      const lat = parseFloat(m.latitude);
      const lon = parseFloat(m.longitude);
      if (!lat || !lon) continue;
      if (haversineKm(refLat, refLon, lat, lon) > radiusKm) continue;
    }

    matched.push(valeur / surface);
    if (!latestDate || dateVente > latestDate) latestDate = dateVente;
  }

  return { prixM2s: matched, latestDate };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { adresse, surface: surfaceStr, type, etat, options: optionsStr } = req.query;

  if (!adresse || !surfaceStr || !type || !etat) {
    return res.status(400).json({ error: 'Params requis : adresse, surface, type, etat' });
  }
  if (!ETAT_MULT[etat]) {
    return res.status(400).json({ error: `etat invalide. Valeurs : ${Object.keys(ETAT_MULT).join(', ')}` });
  }
  if (!TYPE_LOCAL_MAP[type]) {
    return res.status(400).json({ error: `type invalide. Valeurs : ${Object.keys(TYPE_LOCAL_MAP).join(', ')}` });
  }

  const surface = parseFloat(surfaceStr);
  if (!surface || surface <= 0) return res.status(400).json({ error: 'surface invalide' });

  const options = optionsStr ? optionsStr.split(',').map(o => o.trim().toLowerCase()).filter(o => o in OPTION_BONUS) : [];
  const typeLocal = TYPE_LOCAL_MAP[type];

  // ── 1. Géocodage ─────────────────────────────────────────────────────────
  let lat, lon, citycode, commune;
  try {
    const geoUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) });
    if (!geoRes.ok) throw new Error(`Geocoding HTTP ${geoRes.status}`);
    const geoData = await geoRes.json();
    const feat = geoData?.features?.[0];
    if (!feat) return res.status(422).json({ error: 'Adresse introuvable' });
    [lon, lat] = feat.geometry.coordinates;
    citycode = feat.properties.citycode;
    commune = feat.properties.city || feat.properties.label;
  } catch (e) {
    console.error('[estimate-immo] geocoding:', e.message);
    return res.status(502).json({ error: `Géocodage impossible : ${e.message}` });
  }

  // ── 2. DVF — cache par commune+type ──────────────────────────────────────
  const cacheKey = `estimate:${citycode}:${type}`;
  let mutations;
  const cached = await getCached(cacheKey);
  if (cached) {
    try { mutations = JSON.parse(cached); } catch { mutations = null; }
  }

  if (!mutations) {
    try {
      const dvfUrl = `https://api.cquest.org/dvf?code_commune=${encodeURIComponent(citycode)}&section=&numero=`;
      const dvfRes = await fetch(dvfUrl, { signal: AbortSignal.timeout(20000) });
      if (!dvfRes.ok) throw new Error(`DVF HTTP ${dvfRes.status}`);
      const dvfData = await dvfRes.json();
      mutations = dvfData?.resultats || dvfData?.features?.map(f => f.properties) || dvfData || [];
      if (!Array.isArray(mutations)) mutations = [];
      await setCached(cacheKey, JSON.stringify(mutations), 86400);
    } catch (e) {
      console.error('[estimate-immo] DVF:', e.message);
      return res.status(502).json({ error: `DVF inaccessible : ${e.message}` });
    }
  }

  // ── 3. Calcul médiane (rayon 1km, puis commune entière si < 5 ventes) ────
  let { prixM2s, latestDate } = filterAndComputeMedian(mutations, typeLocal, lat, lon, 1);

  if (prixM2s.length < 5) {
    const communeResult = filterAndComputeMedian(mutations, typeLocal, lat, lon, null);
    prixM2s = communeResult.prixM2s;
    latestDate = communeResult.latestDate;
  }

  if (!prixM2s.length) {
    return res.status(404).json({ error: 'Aucune transaction DVF trouvée pour ce type de bien dans cette commune' });
  }

  const prixM2Base = median(prixM2s);

  // ── 4. Coefficients ───────────────────────────────────────────────────────
  const etatMult = ETAT_MULT[etat];
  const optionBonus = options.reduce((sum, o) => sum + (OPTION_BONUS[o] || 0), 0);
  const totalMult = etatMult + optionBonus;

  const prixM2Corrige = prixM2Base * totalMult;
  const estimation = Math.round(prixM2Corrige * surface);
  const fourchetteBasse = Math.round(estimation * 0.90);
  const fourchetteHaute = Math.round(estimation * 1.10);

  return res.json({
    prixM2:           Math.round(prixM2Corrige),
    estimation,
    fourchetteBasse,
    fourchetteHaute,
    nbTransactions:   prixM2s.length,
    commune,
    dateDerniereVente: latestDate ? latestDate.toISOString().slice(0, 10) : null,
  });
};
