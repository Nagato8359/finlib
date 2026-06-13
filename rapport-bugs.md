# Rapport d'analyse Capitaly — 2026-06-13

Analyse complète de `src/components/`, `src/hooks/`, `api/`, `vercel.json`.  
**Aucun fichier modifié. Aucun push.**

---

## 1. BUGS DÉTECTÉS

### 🔴 CRITIQUE (P0)

#### B1 — `api/intraday.js` : utilise `yfGet` direct sans fallback query2
**Fichiers :** `api/intraday.js:7, 23`

`fetchEURUSDHourly` et `fetchYFHourly` appellent `yfGet` avec une URL hardcodée `query1.finance.yahoo.com`. Si query1 est bloqué sur Vercel, le graphique intraday échoue sans essayer query2 — contrairement à `performance.js` et `cron-prices.js` qui utilisent correctement `yfGetWithFallback`.

```js
// Ligne 7 — intraday.js
const data = await yfGet('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?...')
// Devrait être yfGetWithFallback('/v8/finance/chart/EURUSD=X?...')
```

---

#### B2 — `api/cron-prices.js` : endpoint non protégé si `CRON_SECRET` absent
**Fichier :** `api/cron-prices.js:65`

```js
if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

Si `CRON_SECRET` n'est pas défini dans les env vars Vercel, la condition `&&` est immédiatement fausse — le cron s'exécute sans aucune authentification. N'importe qui peut appeler `/api/cron-prices` et déclencher des centaines d'appels Yahoo Finance + la lecture de `user_data` de TOUS les utilisateurs via la service role key.

**Correction :** inverser la logique — bloquer si `CRON_SECRET` n'est pas défini OU si le token ne correspond pas.

---

#### B3 — `api/_supabase.js` : `supabaseAdmin` dégradé silencieusement en anon si `SUPABASE_SERVICE_ROLE_KEY` absent
**Fichier :** `api/_supabase.js:10`

```js
exports.supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey);
```

Si la variable d'env n'est pas configurée, `supabaseAdmin` est identique à `supabaseAnon`. Le cron sera bloqué par RLS sur la lecture de `user_data` (SELECT all users), et échouera silencieusement (renvoie 0 ticker à mettre à jour).

---

#### B4 — Colonnes Supabase non confirmées dans le payload de sauvegarde
**Fichier :** `src/hooks/useData.js:307-312`

Les colonnes `custom_budgets`, `loans`, `debts` sont dans le payload envoyé à Supabase mais aucune migration SQL n'a été créée pour elles (seules `add_profiles.sql` et `add_prices_cache.sql` existent). Si ces colonnes n'existent pas dans `user_data`, chaque sauvegarde échoue (le `SAVE ERROR` dans la console révèle lequel). Les données ne persistent pas entre les sessions.

**Action requise (côté Supabase) :** vérifier la structure de `user_data` dans Supabase → Table Editor et confirmer ces colonnes.

---

#### B5 — `IATab.jsx` : données financières exposées dans la console navigateur
**Fichier :** `src/components/IATab.jsx:263`

```js
console.log('=== CONTEXTE ENVOYÉ À L\'IA ===', ctx.current);
```

Ce log en production expose la totalité du patrimoine, investissements, revenus, dettes de l'utilisateur dans la console DevTools — visible par n'importe qui ayant accès physique ou distant au navigateur.

---

#### B6 — `api/gemini.js` : log de clé API en production
**Fichier :** `api/gemini.js:50-51`

```js
console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
console.log('OPENROUTER_API_KEY prefix:', process.env.OPENROUTER_API_KEY?.substring(0, 10));
```

Expose les 10 premiers caractères de la clé API dans les logs Vercel (visibles de tous les membres du projet Vercel).

---

### 🟠 MOYEN (P1)

#### B7 — `api/intraday.js` : timeout potentiel de 16s sur Vercel Free (limite 10s)
**Fichier :** `api/intraday.js:24`

`fetchYFHourly` utilise `yfGet` qui a `AbortSignal.timeout(8000)`. Si on migre vers `yfGetWithFallback`, query1 (8s) + query2 (8s) = 16s max, au-dessus de la limite Vercel Free (10s) et même Vercel Pro (300s pour Serverless, mais la plupart du temps ils ont une limite effective de 10-30s selon la config).

`performance.js` a le même risque potentiel sur les timeframes non-1J.

---

#### B8 — `api/search.js` : User-Agent tronqué, sans headers Accept, sans fallback query2
**Fichier :** `api/search.js:2`

```js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
```

UA tronqué (pas de Chrome/version/Safari), pas de `Accept-Language`, pas de fallback vers query2 si query1 retourne 502. Incohérent avec le correctif appliqué dans `_priceUtils.js`.

---

#### B9 — `src/hooks/useData.js` : 4 `catch {}` silencieux restants
**Fichier :** `src/hooks/useData.js:246, 255, 271, 281`

Les fonctions `loadUserData`, `loadProfiles`, `addProfile` et `switchProfile` ont des blocs `catch {}` vides. Si une erreur réseau ou Supabase survient, aucun diagnostic n'est possible.

```js
} catch {}  // ligne 246 — loadUserData
} catch {}  // ligne 255 — loadProfiles
} catch {}  // ligne 271 — addProfile (intérieur)
```

---

#### B10 — `IATab.jsx` : contexte IA calculé une seule fois au mount
**Fichier :** `src/components/IATab.jsx:251`

```js
const ctx = useRef(buildContext(data));
```

`buildContext(data)` est appelé une seule fois lors du premier rendu. Si l'utilisateur ajoute une transaction, modifie un investissement ou change un budget après avoir ouvert l'onglet IA, l'assistant répond sur des données obsolètes pour toute la session.

---

#### B11 — `ProfilePage.jsx` : profil utilisateur stocké uniquement en localStorage
**Fichier :** `src/components/ProfilePage.jsx:60-63`

```js
localStorage.setItem('ct_profile', JSON.stringify(profile));
```

Toutes les données personnelles (prénom, nom, adresse, téléphone, situation familiale, etc.) sont uniquement dans le localStorage du navigateur. En navigation privée, sur un autre appareil, ou après vidage du cache, tout est perdu. Aucune synchronisation Supabase.

---

#### B12 — `Flux.jsx:391` : variable `t` (transaction) masque `t` (traduction)
**Fichier :** `src/components/Flux.jsx:391`

```js
const { t } = useTranslation();  // ligne 9
// ...
{filtered.map(t => {  // ligne 391 — masque la fonction t()
```

La variable de boucle `t` (transaction) masque la fonction de traduction `t()` dans le scope de la map. Actuellement sans effet car aucune traduction n'est appelée dans ce bloc, mais toute future utilisation de `t('clé')` dans ce `map` appellerait la transaction par erreur.

---

### 🟡 MINEUR (P2)

#### B13 — `Patrimoine.jsx:107` : anti-pattern `setState || action()`
**Fichier :** `src/components/Patrimoine.jsx:107`

```js
onClick={() => setDrillInv(null) || delInv(cur.id)}
```

Fonctionne (car `setDrillInv` retourne `undefined`) mais confusant. Devrait être `() => { setDrillInv(null); delInv(cur.id); }`.

---

#### B14 — `Flux.jsx:284` : propriété CSS invalide `align`
**Fichier :** `src/components/Flux.jsx:284`

```js
style={{ display: 'flex', align: 'center', gap: 10 }}
```

`align` n'est pas une propriété CSS inline valide. Devrait être `alignItems: 'center'`. L'élément ne s'aligne pas correctement.

---

## 2. ERREURS ESLINT

ESLint (`react-app`) est propre sur les fichiers composants et API. Les seuls `// eslint-disable-next-line` légitimes se trouvent dans :

- `src/components/Header.jsx:108` — `useMemo` avec deps array manuel pour `computeTrophies`
- `src/components/ProfilePage.jsx:77` — `useCallback` avec deps array manuel pour `save`

Ces suppressions masquent des dépendances potentiellement manquantes (voir B10 et sections Performance). En dehors de cela, aucun warning ESLint actif.

---

## 3. PERFORMANCE

### P-1 — Cache L1 en mémoire illusoire en serverless
**Fichier :** `api/_priceUtils.js:14`

```js
const cache = {};  // vidé à chaque cold start Vercel
```

La variable `cache` module-level est perdue entre les invocations cold start. Redis (L2) compense, mais le commentaire architectural "L1 in-memory" est trompeur : il ne fonctionne que sur les invocations chaudes.

### P-2 — `performance.js` : double timeout possible (16s) sur Vercel
Voir B7. Sur des timeframes != 1J, `yfGetWithFallback` peut prendre jusqu'à 16s avant d'échouer.

### P-3 — `cron-prices.js` : pas de batching ni de limite de tickers
Le cron itère sur tous les portfolios de tous les utilisateurs sans limite. Avec une croissance de l'app, le cron pourrait dépasser la limite de durée Vercel.

### P-4 — `Patrimoine.jsx` : composant monolithique ~980 lignes
`renderInvest`, `renderCash`, `renderMateriel`, `renderLoans`, `renderProjection` sont des fonctions inline recréées à chaque render. À décomposer en sous-composants avec `memo` si des problèmes de performance apparaissent.

### P-5 — `IATab.jsx` : re-analyse automatique à chaque mount
`useEffect(() => { runAnalysis(); }, [])` appelle l'API Gemini/OpenRouter immédiatement à chaque montage du composant IA, même si la dernière analyse date de 10 secondes. Coûteux si l'utilisateur navigue fréquemment vers l'onglet IA.

---

## 4. SÉCURITÉ

### S-1 — CORS wildcard sur endpoint POST `/api/gemini`
**Fichier :** `api/gemini.js:45`

`Access-Control-Allow-Origin: *` sur une route POST permet à n'importe quel site tiers de proxyfier des requêtes via votre clé OpenRouter. Devrait être restreint à l'origine de l'app (`https://finlib-six.vercel.app`).

### S-2 — Endpoint cron non protégé (voir B2, P0)

### S-3 — Dégradation silencieuse de la service role key (voir B3, P0)

### S-4 — Données financières dans la console (voir B5, P0)

### S-5 — Validation insuffisante côté `api/gemini.js` pour auto-analysis
La limite des 500 caractères s'applique uniquement aux messages manuels (`isAutoAnalysis === false`). L'analyse automatique envoie le JSON complet des données sans validation de longueur. Un payload très large (plusieurs centaines de positions) peut dépasser les limites de token du modèle.

### S-6 — `supabase.auth.updateUser` dans `ProfilePage.jsx` côté client
**Fichier :** `src/components/ProfilePage.jsx:66`

Le changement de mot de passe via `supabase.auth.updateUser({ password })` côté client est normal pour Supabase, mais nécessite que l'utilisateur soit authentifié (la session est active). Si la session a expiré, l'erreur est correctement catchée et affichée. OK.

---

## 5. COHÉRENCE

### C-1 — `COMMODITY_TICKER_MAP` dupliqué dans deux fichiers
**Fichiers :** `src/hooks/useData.js:12-16` et `api/cron-prices.js:4-7`

La même map est définie deux fois. Si une nouvelle matière première est ajoutée, deux fichiers doivent être mis à jour. À extraire dans `api/_priceUtils.js` (côté serveur) et une constante partagée côté client.

### C-2 — `mLeft(endDate)` dupliqué dans 3 composants
**Fichiers :** `Budget.jsx:4`, `Patrimoine.jsx:6`, `Modals.jsx:38`

Même fonction de calcul "mois restants" dupliquée dans 3 fichiers. À extraire dans `src/utils/constants.js`.

### C-3 — `intraday.js` incohérent avec les autres endpoints (`yfGet` vs `yfGetWithFallback`)
Voir B1 et B8. Trois endpoints différents utilisent trois niveaux de robustesse différents pour Yahoo Finance.

### C-4 — `api/cron-prices.js` stocke `key` (ISIN) dans `prices_cache.ticker`
**Fichier :** `api/cron-prices.js:115`

```js
{ ticker: key, ... }  // key peut être un ISIN ou un ticker selon la source
```

Cela est cohérent avec `performance.js` qui query avec `upperKey` (l'ISIN ou le ticker original). Mais le nom de colonne `ticker` est sémantiquement trompeur quand il contient un ISIN.

### C-5 — `api/gemini.js` s'appelle "gemini" mais utilise OpenRouter
Le fichier s'appelle `gemini.js`, la variable est `OPENROUTER_API_KEY`, et le modèle utilisé est `qwen/qwen3-235b-a22b:free`. Le nom est trompeur pour la maintenance.

### C-6 — `Accueil.jsx` fetch les prix via `/api/prices` (batch), `Patrimoine.jsx` via `fetchPrices` (même endpoint)
Cohérent — les deux utilisent `/api/prices?tickers=...`. OK.

### C-7 — `savePreferences` dans `useData.js` n'est pas dans le payload du bloc de sauvegarde principal
La colonne `preferences` est lue dans `loadUserData:244` mais est sauvegardée via un appel séparé `savePreferences` (jamais appelé dans le code source analysé — potentiellement orphelin).

---

## 6. PRIORITÉS

| Priorité | ID | Fichier | Description |
|---|---|---|---|
| 🔴 P0 | B2 | `api/cron-prices.js:65` | Cron non protégé si `CRON_SECRET` absent |
| 🔴 P0 | B3 | `api/_supabase.js:10` | `supabaseAdmin` dégradé silencieusement en anon |
| 🔴 P0 | B4 | `src/hooks/useData.js:307-312` | Colonnes Supabase non confirmées (`custom_budgets`, `loans`, `debts`) |
| 🔴 P0 | B5 | `src/components/IATab.jsx:263` | `console.log` expose données financières en production |
| 🔴 P0 | B6 | `api/gemini.js:50-51` | Log du préfixe de clé API en production |
| 🟠 P1 | B1 | `api/intraday.js:7,23` | `yfGet` direct sans fallback query2 |
| 🟠 P1 | B7 | `api/intraday.js` | Timeout potentiel 16s > limite Vercel Free (10s) |
| 🟠 P1 | B8 | `api/search.js:2` | UA tronqué, pas de fallback, pas d'Accept headers |
| 🟠 P1 | B9 | `src/hooks/useData.js` | 4 `catch {}` silencieux (loadUserData, loadProfiles, addProfile) |
| 🟠 P1 | B10 | `src/components/IATab.jsx:251` | Contexte IA non réactualisé après mount |
| 🟠 P1 | B11 | `src/components/ProfilePage.jsx:60` | Profil stocké localStorage uniquement (non synchronisé Supabase) |
| 🟠 P1 | S-1 | `api/gemini.js:45` | CORS wildcard sur POST |
| 🟡 P2 | B12 | `src/components/Flux.jsx:391` | Variable `t` masque la fonction de traduction |
| 🟡 P2 | B14 | `src/components/Flux.jsx:284` | `align` invalide au lieu de `alignItems` |
| 🟡 P2 | C-1 | useData.js + cron-prices.js | `COMMODITY_TICKER_MAP` dupliqué |
| 🟡 P2 | C-2 | Budget, Patrimoine, Modals | `mLeft()` dupliqué 3× |
| 🟡 P2 | P-5 | IATab.jsx | Re-analyse API à chaque mount de l'onglet IA |

---

## Actions immédiates recommandées

1. **Corriger B2** : changer la condition de protection du cron pour bloquer si `CRON_SECRET` est absent.
2. **Supprimer B5 + B6** : retirer les `console.log` de prod avant tout (risque RGPD sur B5).
3. **Vérifier B4** : ouvrir Supabase → Table Editor → `user_data` et confirmer les colonnes `custom_budgets`, `loans`, `debts` existent, sinon créer la migration.
4. **Corriger B1 + B8** : aligner `intraday.js` et `search.js` sur `yfGetWithFallback` et les headers complets.
5. **Configurer les env vars Vercel** : `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (pour B2 et B3).
