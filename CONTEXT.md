# Capitaly — Contexte projet

Application web de gestion de patrimoine personnel (React + Vercel + Supabase).
Nom de code interne : **finlib**. Repo : `https://github.com/Nagato8359/finlib.git`, branche `main`.

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | React | 19.2.7 |
| Build | Create React App / react-scripts | 5.0.1 |
| Charts | Recharts | 3.8.1 |
| Database | Supabase (PostgreSQL + Auth + RLS) | 2.108.0 |
| Backend | Vercel Serverless Functions (Node.js) | — |
| Cache API | Upstash Redis (REST) | 1.38.0 |
| Push notifications | web-push (VAPID) | 3.6.7 |
| IA | Google Gemini (`gemini-1.5-flash` via REST) | — |
| Prix actions | Yahoo Finance (non-officiel, via proxy) | — |
| Prix crypto | CoinGecko (non-officiel) | — |
| Prix EVM tokens | Blockscout v2 (6 réseaux) | — |
| Prix RealT | Blockscout + DisperseV2 | — |
| Logos actifs | Logo.dev (ticker API) + Yahoo Finance | — |
| Mobile (futur) | Capacitor (Android + iOS) | 8.4.0 |
| Analytics | Vercel Analytics | 2.0.1 |
| Dev local backend | Express | 5.2.1 |
| HTTP client | Axios | 1.17.0 |

---

## Architecture

### Fichiers API Vercel (`api/`)

Limite Vercel Hobby : **12 fonctions** (fichiers non-underscore). Actuellement : **10 utilisées**.

| Fichier | Route | Méthode | Rôle | Cache |
|---------|-------|---------|------|-------|
| `prices.js` | `/api/prices?tickers=A,B` | GET | Prix batch depuis `prices_cache` Supabase, fallback Yahoo Finance | 15 min |
| `price/[ticker].js` | `/api/price/:ticker` | GET | Prix unitaire (ISIN ou ticker), résolution YF ou CoinGecko | Dynamique |
| `intraday.js` | `/api/intraday?ticker=X` | GET | Données OHLC horaires (graphe intraday YF) | Court |
| `search.js` | `/api/search?type=stock\|crypto&q=X` | GET | Proxy CORS pour Yahoo Finance + CoinGecko search | Aucun |
| `dividends.js` | `/api/dividends?tickers=X,Y` | GET | Historique dividendes depuis `dividend_events` + fallback YF | 24 h |
| `crypto-wallet.js` | `/api/crypto-wallet?address=0x...&network=all\|ethereum\|...` | GET | Balances ERC-20 + natifs via Blockscout (6 réseaux) | 5 min |
| `realt.js` | `/api/realt?action=wallet\|rents&address=0x...` | GET | Tokens RealT + historique loyers USDC | 1 h |
| `performance.js` | `/api/performance?ticker=X&tf=1J\|1S\|1M\|3M\|1AN` | GET | % de variation sur période via Yahoo Finance | Court |
| `gemini.js` | `/api/gemini` | POST | IA conseiller financier (Google Gemini 1.5 Flash, contexte portfolio) | Aucun |
| `push.js` | `/api/push?action=subscribe\|send\|test` | GET/POST | Gestion abonnements Web Push + envoi notifications | Aucun |
| `cron-prices.js` | Cron interne | — | Sync périodique prix → table `prices_cache` | — |

**Helpers** (prefixe `_`, ne comptent pas dans la limite) :

| Fichier | Rôle |
|---------|------|
| `_cache.js` | Wrapper Upstash Redis (`getCached` / `setCached`) |
| `_supabase.js` | Clients Supabase (anon + service\_role) |
| `_priceUtils.js` | Fetchers Yahoo Finance, CoinGecko, conversion EUR/USD |
| `_push.js` | Envoi Web Push via `web-push` |

### Réseaux EVM supportés (`crypto-wallet.js`)

| Clé | Hôte Blockscout | Natif |
|-----|-----------------|-------|
| `ethereum` | eth.blockscout.com | ETH |
| `bsc` | bsc.blockscout.com | BNB |
| `polygon` | polygon.blockscout.com | POL |
| `arbitrum` | arbitrum.blockscout.com | ETH |
| `optimism` | optimism.blockscout.com | ETH |
| `gnosis` | gnosis.blockscout.com | XDAI |

---

### Base de données Supabase

#### Table principale : `user_data`

Toutes les données utilisateur dans une seule ligne JSON par profil. Colonnes :

| Colonne | Type | Contenu |
|---------|------|---------|
| `user_id` | UUID (FK auth.users) | Identifiant utilisateur |
| `profile_id` | UUID (FK profiles, nullable) | Profil nommé (NULL = profil principal) |
| `transactions` | JSONB | Toutes les transactions (revenus/dépenses) |
| `investments` | JSONB | Enveloppes d'investissement + positions |
| `health_assets` | JSONB | Actifs matériels (véhicules, collections…) |
| `budgets` | JSONB | Budgets par catégorie |
| `custom_budgets` | JSONB | Budgets personnalisés |
| `goals` | JSONB | Objectifs financiers |
| `savings` | JSONB | Comptes d'épargne / livrets |
| `listings` | JSONB | Biens immobiliers en location |
| `sold_history` | JSONB | Historique des ventes |
| `loans` | JSONB | Crédits immobiliers |
| `debts` | JSONB | Autres dettes |
| `proj_years` | INT | Durée projection (défaut 20 ans) |
| `proj_rate` | NUMERIC | Taux annuel projection (défaut 7%) |
| `proj_monthly` | NUMERIC | Versement mensuel projection |
| `preferences` | JSONB | Thème, langue, devise, format date… |
| `updated_at` | TIMESTAMPTZ | Dernière sauvegarde |

Contraintes : `UNIQUE(user_id)` pour profil principal, `UNIQUE(user_id, profile_id)` pour profils nommés. RLS activé.

#### Autres tables

| Table | Colonnes clés | Rôle | RLS |
|-------|--------------|------|-----|
| `profiles` | `id, user_id, label, created_at` | Profils nommés (multi-profil) | Oui |
| `prices_cache` | `ticker (PK), price, change_pct, currency, updated_at` | Cache prix lecture publique | Oui (read public) |
| `dividend_events` | `ticker, ex_date (UNIQUE), payment_date, amount, currency, amount_eur` | Événements dividendes | Oui (read public, write service\_role) |
| `patrimoine_history` | `user_id, valeur, recorded_at` | Snapshots mensuels de patrimoine | Oui |
| `push_subscriptions` | `user_id, subscription (JSONB), endpoint (UNIQUE per user)` | Abonnements Web Push | Oui |

---

### Composants React (`src/components/`)

#### Pages principales

| Composant | Onglet | Rôle |
|-----------|--------|------|
| `Accueil.jsx` | `accueil` | Dashboard : KPI patrimoine, sparklines, camembert répartition, trophées |
| `Patrimoine.jsx` | `patrimoine` | Inventaire complet : investissements, épargne, actifs matériels, prêts, immobilier |
| `Budget.jsx` | `budget` | Suivi budgets catégories, objectifs avec countdown, taux d'endettement |
| `Flux.jsx` | `flux` | Relevé transactions, import/export CSV, prévision trésorerie 90 jours |
| `Investir.jsx` | `investir` | Recommandations courtiers/plateformes |
| `IATab.jsx` | `ia` | Conseiller IA (Gemini) avec contexte portfolio complet |

#### Outils (`src/components/outils/`)

| Composant | Route | Rôle |
|-----------|-------|------|
| `Projection.jsx` | `projection` | Simulation croissance patrimoine (taux, durée, versement mensuel) |
| `CalendrierDividendes.jsx` | `calendrier-dividendes` | Calendrier dividendes avec dates ex/paiement et montants |
| `RecapFiscal.jsx` | `recap-fiscal` | Récap fiscal FR : dividendes bruts/nets, loyers, IFI, flat-tax crypto |
| `Simulateur.jsx` | `simulateur` | Calculateurs : DCA, intérêts composés, amortissement prêt |
| `Rebalancing.jsx` | `rebalancing` | Rééquilibrage : allocation cible (sliders), écart €/%, actions achat/vente |

**Pages Coming Soon** (non implémentées) : `veille-marche`, `optimisation-fiscale`.

#### Modaux & layout

| Composant | Rôle |
|-----------|------|
| `Modals.jsx` | Tous les formulaires CRUD (investissement, position, compte, dividende…) |
| `PositionFormModal.jsx` | Formulaire spécialisé titres (recherche ticker, prix live) |
| `Sidebar.jsx` | Navigation gauche desktop (220px fixe) + sous-menu Outils |
| `Navigation.jsx` | Nav mobile bas d'écran |
| `Header.jsx` | Barre haut : thème, devise, langue, profil, export/import |
| `AuthScreen.jsx` | Login / inscription Supabase + mode démo |
| `ResetPassword.jsx` | Réinitialisation mot de passe |
| `ProfilePage.jsx` | Paramètres profil utilisateur |
| `TrophiesPage.jsx` | Page badges/trophées |
| `Confetti.jsx` | Animation célébration achievements |
| `Tutorial/TutorialSlides.jsx` | Onboarding slides |
| `Tutorial/TutorialTooltips.jsx` | Tooltips interactifs guidés |

---

### Hooks (`src/hooks/`)

| Hook | Rôle |
|------|------|
| `useData.js` | Store central : charge/sauve Supabase, calcule patrimoine, dividendes, budget, récurrents |
| `useTheme.js` | Thème dark/light, couleur accent, devise, format date, langue |
| `useTranslation.js` | Accès au `t()` i18n depuis n'importe quel composant |

**`useData` — valeurs retournées clés :**

```js
{
  investments,          // array d'enveloppes avec positions
  invLiveValue(inv),    // valeur live d'une enveloppe (positions × prix + cash)
  cashTotal,            // total épargne/livrets
  healthTotal,          // total actifs matériels
  invTotal,             // total investments live
  patrimoine,           // invTotal + cashTotal + healthTotal - dettes
  cashAccounts,         // array livrets/comptes
  healthAssets,         // array actifs matériels
  listings,             // array biens immobiliers
  transactions,         // array toutes transactions
  budgets, goals,       // budget et objectifs
  loans, debts,         // crédits et dettes
  computedSavings,      // épargne nette mensuelle calculée
  projData, projYears, projRate, projMonthly, // projection
}
```

---

### Utilitaires (`src/utils/`)

| Fichier | Exports clés |
|---------|-------------|
| `constants.js` | `makeS(T)` (styles), `fEur()`, `fPct()`, `fDate()`, `fPrice()`, `PORTFOLIO_TYPES` (43 types), `CAT_COLORS`, `KPI`, `TT` |
| `settings.js` | `t()` (i18n), `fEur()` (avec conversion devise), `fDate()` |
| `trophies.js` | Calcul points/badges, 6 niveaux (Bronze → Élite), ~10 catégories |
| `notifications.js` | `requestNotifPermission()`, `notifyOnce()`, rappels quotidiens |

**`makeS(T)`** retourne : `S.card`, `S.inp`, `S.btnG` (vert), `S.btnS` (secondaire), `S.btnD` (danger).

#### Types d'investissement reconnus (43 types)

PEA, CTO, Assurance-vie, Assurance-vie fonds euros, PER, Épargne salariale, Crypto, SCPI, OPCI, SCI, RealT, La Première Brique, Tantiem, Bricks.co, Crowdfunding immobilier, Crowdfunding entreprise, Immobilier, Private Equity, Obligations, Matières premières, Art & Collections, Forêts / GFI, Vignes / GFV, Autre.

**Types à prix manuel** (pas de Yahoo Finance) : RealT, SCPI, OPCI, SCI, Private Equity, Art & Collections, Forêts / GFI, Vignes / GFV, PER, Assurance-vie fonds euros.

#### Mapping Matières premières → Yahoo Finance

| Matière | Ticker YF |
|---------|-----------|
| Or | GC=F |
| Argent | SI=F |
| Platine | PL=F |
| Palladium | PA=F |
| Pétrole | CL=F |
| Cuivre | HG=F |

---

### Contextes (`src/context/`)

| Fichier | Rôle |
|---------|------|
| `LanguageContext.jsx` | Provider i18n, expose `language` + `t(key)` (fallback FR si clé manquante) |

---

## Variables d'environnement

Toutes définies dans `.env` local et dans les **Environment Variables Vercel**.

| Variable | Usage | Côté |
|----------|-------|------|
| `REACT_APP_SUPABASE_URL` | URL projet Supabase | Frontend |
| `REACT_APP_SUPABASE_ANON_KEY` | Clé anon Supabase (lecture publique RLS) | Frontend |
| `REACT_APP_VAPID_PUBLIC_KEY` | Clé publique Web Push | Frontend |
| `SUPABASE_URL` | URL Supabase (fonctions serverless) | Backend |
| `SUPABASE_ANON_KEY` | Clé anon (fonctions serverless) | Backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (écriture `dividend_events`, etc.) | Backend uniquement |
| `UPSTASH_REDIS_REST_URL` | Endpoint Upstash Redis | Backend |
| `UPSTASH_REDIS_REST_TOKEN` | Token auth Upstash | Backend |
| `VAPID_PUBLIC_KEY` | Clé pub VAPID (doit correspondre à REACT_APP_*) | Backend |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID (secret absolu) | Backend |
| `VAPID_EMAIL` | Email expéditeur push | Backend |
| `GEMINI_API_KEY` | Clé API Google Gemini | Backend |

> **Règle** : jamais de `SUPABASE_SERVICE_ROLE_KEY` côté frontend. Jamais de `VAPID_PRIVATE_KEY` exposé.

---

## Fonctionnalités implémentées

### Core
- [x] Auth Supabase (email/password + reset)
- [x] Multi-profils (profil principal + profils nommés)
- [x] Mode démo (données fictives sans compte)
- [x] Sauvegarde auto Supabase avec debounce 500ms
- [x] Import/export JSON global
- [x] Thème dark/light + 4 couleurs accent
- [x] 7 devises (EUR/USD/GBP/CHF/JPY/CAD/AUD) avec conversion
- [x] I18n FR/EN
- [x] Format date configurable (dd/mm, mm/dd, yyyy-mm-dd)
- [x] Tutorial onboarding (slides + tooltips interactifs)
- [x] Système trophées/badges (6 niveaux, ~10 catégories)

### Patrimoine & Investissements
- [x] 43 types d'enveloppes d'investissement
- [x] Positions par enveloppe (titres, parts, lots)
- [x] Prix live (Yahoo Finance pour actions/ETF/matières, CoinGecko pour crypto)
- [x] Cache prix Supabase `prices_cache` (sync par cron)
- [x] Logos actifs : Logo.dev ticker API + Yahoo Finance search (cascade)
- [x] Import wallet EVM (0x) : détection auto tokens ERC-20 + natifs, 6 réseaux Blockscout
- [x] Sync wallet EVM (bouton dans drill-down Crypto)
- [x] Import RealT (wallet Ethereum + historique loyers USDC)
- [x] Bouton liquidités par enveloppe
- [x] Snapshot mensuel patrimoine → `patrimoine_history`
- [x] Comptes épargne / livrets (Livret A, LDDS, PEL…)
- [x] Actifs matériels (véhicules, bijoux, collections…)
- [x] Prêts immobiliers (amortissement, coût total, date fin)
- [x] Biens en location (loyers, charges, rentabilité)

### Budget & Flux
- [x] Budgets par catégorie avec barres de progression
- [x] Objectifs financiers avec countdown et progression
- [x] Transactions manuelles + transactions récurrentes auto-générées
- [x] Import CSV transactions (auto-catégorisation)
- [x] Export CSV
- [x] Prévision trésorerie 30/60/90 jours
- [x] Taux d'endettement (crédit / revenus)
- [x] Fonds d'urgence (mois de dépenses couverts)

### Outils
- [x] **Projection** : simulation croissance avec sliders + inputs numériques, jalons, graphe Recharts
- [x] **Calendrier dividendes** : dates ex/paiement, montants, marquer comme reçu
- [x] **Récap fiscal** : dividendes, loyers, IFI, flat-tax crypto
- [x] **Simulateur** : DCA, intérêts composés, amortissement prêt
- [x] **Rebalancing** : 9 catégories, camembert allocation, sliders cible (localStorage), tableau écarts, cards mobile

### Notifications
- [x] Web Push (VAPID) via Service Worker
- [x] Souscription persistée en `push_subscriptions`
- [x] Notifications push uniquement (in-app notifications supprimées)

### IA
- [x] Chat Gemini avec contexte portfolio complet injecté en system prompt

---

## Bugs connus / limites

| Sujet | Description | Statut |
|-------|-------------|--------|
| Blockscout `exchange_rate` null | Certains tokens stables (ex: USDC sur Gnosis) renvoient `exchange_rate: null` → fixé avec fallback stablecoin ($1) | Corrigé (`fix: USDC price on Gnosis`) |
| Yahoo Finance rate limits | L'API non-officielle peut bloquer les requêtes (429) sous charge → Upstash cache atténue le problème | Contournement en place |
| Vercel Hobby limit | Max 12 fonctions serverless (non-underscore) — actuellement 10 | Surveiller avant d'ajouter |
| CoinGecko dépréciation | L'API v3 sans clé est de plus en plus limitée | À surveiller |
| Capacitor mobile | Build Android/iOS déclaré dans package.json mais pas encore configuré/testé | Non validé |
| Catégories Rebalancing | Basées sur `inv.type` exact — un type mal saisi ne sera pas catégorisé | Normal, pas de bug |

---

## Décisions techniques importantes

### 1. `user_data` — une seule ligne JSON par profil
Toutes les données (transactions, investissements, objectifs…) sont sérialisées en JSONB dans une seule ligne par utilisateur. Avantage : 0 JOIN, sauvegarde atomique. Inconvénient : pas de queries SQL partielles, taille limitée par Supabase (~1 MB recommandé).

### 2. Prix live côté client via proxy Vercel
Les prix ne sont pas stockés en temps réel (sauf `prices_cache` pour le cache court terme). `invLiveValue(inv)` utilise `currentPrice` stocké dans chaque position et mis à jour au chargement ou manuellement. Évite les coûts de WebSocket.

### 3. Stablecoin fallback dans `crypto-wallet.js`
Blockscout retourne parfois `exchange_rate: null` pour les stablecoins (USDC, USDT, DAI…). Le bug était masqué par `parseFloat(token.exchange_rate || '0')` qui forçait 0 au lieu de laisser NaN. Fix : `parseFloat(token.exchange_rate)` + liste `STABLECOINS` → fallback $1 si exchange_rate invalide.

### 4. `formatCompact` local dans Projection
Plutôt que modifier le `fEur` global (risque de régression), une fonction locale `formatCompact(n)` a été créée dans `Projection.jsx` pour afficher les grands nombres (M€, k€) dans les KPI et l'axe Y du graphe.

### 5. Wallet EVM — champ `adresse` de l'enveloppe
Pour éviter d'ajouter un nouveau champ au modèle, l'adresse wallet EVM est stockée dans le champ existant `portfolioForm.adresse` (inutilisé pour le type Crypto). La validation `^0x[0-9a-fA-F]{40}$` détermine si le bouton "Sync wallet" doit apparaître.

### 6. Sync wallet — merge sans suppression
`syncCwallet` dans `Patrimoine.jsx` ne supprime jamais de positions existantes. Elle met à jour `shares` + `currentPrice` pour les tickers déjà présents, et ajoute les nouveaux. Les positions manuelles (tickers introuvables on-chain) sont préservées.

### 7. Rebalancing — localStorage pour les cibles
Les pourcentages cibles de rebalancing sont sauvegardés localement (`capitaly_rebalancing_target`) et non en base Supabase. Choix délibéré pour éviter une mise à jour du schéma `user_data`. À migrer vers Supabase si la feature devient critique.

### 8. Vercel Functions — préfixe underscore
Les fichiers `api/_*.js` (helpers) ne créent pas de routes HTTP et ne consomment pas de slots dans la limite de 12 fonctions Vercel Hobby.

### 9. Notifications — push only
Les notifications in-app (toasts) ont été supprimées. Seules les notifications Web Push (background) sont conservées, pour éviter la pollution visuelle dans l'UI.

### 10. Logo.dev comme fallback universel
Cascade pour les logos : Yahoo Finance search API → Logo.dev ticker API (`img.logo.dev/ticker/{ticker}?token=...`). Couvre ~95% des tickers actions/ETF. Les tokens crypto ont souvent une `iconUrl` Blockscout ou CoinGecko.

---

## Scripts de développement

```bash
npm start          # Frontend React (port 3000)
npm run server     # Backend Express local (port 3001)
npm run dev        # Concurrent frontend + backend
npm run build      # Build production
```

En production, les routes `/api/*` sont gérées par Vercel Functions (pas Express).

---

## Déploiement

- **Plateforme** : Vercel (plan Hobby)
- **Repo** : `https://github.com/Nagato8359/finlib.git`
- **Branche déployée** : `main`
- **Build command** : `npm run build`
- **Output dir** : `build/`
- **Service Worker** : `/service-worker.js` — headers `no-cache` forcés via `vercel.json`
- **CSP** : `vercel.json` applique une Content-Security-Policy sur toutes les routes
