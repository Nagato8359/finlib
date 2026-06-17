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
| `cron-prices.js` | `/api/cron-prices` | GET (cron) / POST | Sync prix → `prices_cache`, snapshots patrimoine server-side, dividendes, push | — |

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

### Flux prix (cron → cache → frontend)

```
cron-prices.js (Vercel cron, ~toutes les heures)
  → STEP4 : Yahoo Finance / CoinGecko → prices_cache (Supabase)
  → STEP5 : RealT community API → prices_cache
  → STEP6 : calcule patrimoine total par user → patrimoine_history (source: 'cron')

frontend (useData.js)
  → /api/prices?tickers=... → prices_cache (lecture)
  → POST /api/cron-prices?action=snapshot → patrimoine_history (source: 'frontend')
```

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
| `preferences` | JSONB | Thème, langue, devise, format date, notifications… |
| `referral_code` | TEXT | Code parrainage unique généré à la connexion |
| `referred_by` | TEXT | Code parrainage utilisé à l'inscription |
| `pro_bonus_months` | INT | Mois Pro offerts via parrainage |
| `updated_at` | TIMESTAMPTZ | Dernière sauvegarde |

Contraintes : `UNIQUE(user_id)` pour profil principal, `UNIQUE(user_id, profile_id)` pour profils nommés. RLS activé.

#### Autres tables

| Table | Colonnes clés | Rôle | RLS |
|-------|--------------|------|-----|
| `profiles` | `id, owner_user_id, label, created_at` | Profils nommés (multi-profil) | Oui |
| `prices_cache` | `ticker (PK), price, change_pct, currency, updated_at` | Cache prix alimenté par cron, lu par frontend | Oui (read public) |
| `dividend_events` | `ticker, ex_date (UNIQUE avec ticker), payment_date, amount, currency, amount_eur, status (confirmed/estimated), source (yahoo/estimated)` | Événements dividendes passés + estimations futures | Oui (read public, write service\_role) |
| `patrimoine_history` | `id, user_id, valeur, recorded_at, source (frontend/cron)` | Snapshots horaires de patrimoine — double source | Oui |
| `push_subscriptions` | `id, user_id, subscription (JSONB), created_at` | Abonnements Web Push (endpoint unique par user) | Oui |
| `referrals` | `id, referrer_id, referred_id, bonus_months, status, created_at` | Historique parrainages + statut bonus | Oui |

**Index unique** : `patrimoine_history(user_id, recorded_at)` — évite les doublons cron/frontend pour la même heure.

---

### Composants React (`src/components/`)

#### Pages principales

| Composant | Onglet | Rôle |
|-----------|--------|------|
| `Accueil.jsx` | `accueil` | Dashboard : KPI patrimoine, sparklines, camembert répartition, trophées, graphique patrimoine_history |
| `Patrimoine.jsx` | `patrimoine` | Inventaire complet : investissements, épargne, actifs matériels, prêts, immobilier |
| `Budget.jsx` | `budget` | Suivi budgets catégories, objectifs avec countdown, taux d'endettement |
| `Flux.jsx` | `flux` | Relevé transactions, import/export CSV, prévision trésorerie 90 jours |
| `Investir.jsx` | `investir` | Courtiers/plateformes recommandés avec liens affiliés et logos |
| `IATab.jsx` | `ia` | Conseiller IA (Gemini) avec contexte portfolio complet |

#### Outils (`src/components/outils/`)

| Composant | Route | Rôle |
|-----------|-------|------|
| `Projection.jsx` | `projection` | Simulation croissance patrimoine (taux, durée, versement mensuel) |
| `CalendrierDividendes.jsx` | `calendrier-dividendes` | Calendrier dividendes avec dates ex/paiement et montants |
| `RecapFiscal.jsx` | `recap-fiscal` | Récap fiscal FR : dividendes bruts/nets, loyers, IFI, flat-tax crypto |
| `Simulateur.jsx` | `simulateur` | Calculateurs : DCA, intérêts composés, amortissement prêt |
| `SimulateurDividendes.jsx` | `simulateur-dividendes` | Simulation revenus dividendes passifs sur N années |
| `SimulateurRetraite.jsx` | `simulateur-retraite` | Simulateur retraite FR (formules pension + analyse manque à gagner) |
| `VeilleMarche.jsx` | `veille-marche` | Veille marchés financiers, actualités, indices |
| `Rebalancing.jsx` | `rebalancing` | Rééquilibrage : allocation cible (sliders), vrais calculs €/%, ordres achat/vente |

#### Modaux & layout

| Composant | Rôle |
|-----------|------|
| `Modals.jsx` | Tous les formulaires CRUD (investissement, position, compte, dividende…) |
| `PositionFormModal.jsx` | Formulaire spécialisé titres — barre de recherche universelle (ISIN/ticker/nom) avec fallback ISIN manuel |
| `Sidebar.jsx` | Navigation gauche desktop (220px fixe) + sous-menu Outils |
| `Navigation.jsx` | Nav mobile bas d'écran |
| `Header.jsx` | Barre haut : thème, devise, langue, profil, export/import |
| `AuthScreen.jsx` | Login / inscription Supabase + mode démo |
| `ResetPassword.jsx` | Réinitialisation mot de passe (via Resend + capitaly.fr) |
| `ProfilePage.jsx` | Paramètres profil utilisateur + code parrainage |
| `TrophiesPage.jsx` | Page badges/trophées |
| `Confetti.jsx` | Animation célébration achievements |
| `Tutorial/TutorialSlides.jsx` | Onboarding slides |
| `Tutorial/TutorialTooltips.jsx` | Tooltips interactifs guidés |

---

### Hooks (`src/hooks/`)

| Hook | Rôle |
|------|------|
| `useData.js` | Store central : charge/sauve Supabase, calcule patrimoine, dividendes, budget, récurrents, envoie snapshot frontend |
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
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (écriture `dividend_events`, snapshots, etc.) | Backend uniquement |
| `UPSTASH_REDIS_REST_URL` | Endpoint Upstash Redis | Backend |
| `UPSTASH_REDIS_REST_TOKEN` | Token auth Upstash | Backend |
| `VAPID_PUBLIC_KEY` | Clé pub VAPID (doit correspondre à REACT_APP_*) | Backend |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID (secret absolu) | Backend |
| `VAPID_EMAIL` | Email expéditeur push | Backend |
| `GEMINI_API_KEY` | Clé API Google Gemini | Backend |
| `CRON_SECRET` | Secret Bearer pour protéger les endpoints cron | Backend |

> **Règle** : jamais de `SUPABASE_SERVICE_ROLE_KEY` côté frontend. Jamais de `VAPID_PRIVATE_KEY` exposé.

---

## Fonctionnalités implémentées

### Core
- [x] Auth Supabase (email/password + reset mot de passe via Resend + capitaly.fr)
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
- [x] Système de parrainage (code unique, table referrals, 1 mois Pro par filleul)

### Patrimoine & Investissements
- [x] 43 types d'enveloppes d'investissement
- [x] Positions par enveloppe (titres, parts, lots)
- [x] Barre de recherche universelle dans le formulaire d'ajout de position (ISIN/ticker/nom + fallback ISIN manuel)
- [x] Prix live (Yahoo Finance pour actions/ETF/matières, CoinGecko pour crypto)
- [x] Cache prix Supabase `prices_cache` (alimenté par cron, lu par frontend via `/api/prices`)
- [x] Logos actifs : favicons enveloppes + Logo.dev ticker API + Yahoo Finance search (cascade)
- [x] Import wallet EVM (0x) : détection auto tokens ERC-20 + natifs, 6 réseaux Blockscout
- [x] Sync wallet EVM (bouton dans drill-down Crypto)
- [x] Import RealT (wallet Ethereum + historique loyers USDC)
- [x] Bouton liquidités par enveloppe (cash flottant séparé des positions)
- [x] Snapshots patrimoine double-source : frontend (précis, live) + cron server-side (toutes les heures)
- [x] Graphique patrimoine historique depuis `patrimoine_history` Supabase
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
- [x] **Simulateur Dividendes** : projection revenus passifs dividendes sur N années
- [x] **Simulateur Retraite** : formules pension FR + analyse du manque à gagner + intégration patrimoine
- [x] **Veille Marché** : actualités et indices financiers
- [x] **Rebalancing** : allocation cible, vrais calculs €/%, ordres achat/vente générés

### Notifications
- [x] Web Push (VAPID) via Service Worker — iPhone Safari + Chrome
- [x] Souscription persistée en `push_subscriptions`
- [x] Push : rappel inactivité (3j/7j/14j/30j/60j/90j)
- [x] Push : paliers patrimoine franchis (50k, 100k, 150k, 200k, 500k, 1M)
- [x] Push : record patrimoine battu (+0.5% par rapport au max historique)
- [x] Push : dividende imminent (J-3 avant ex-date)
- [x] Push : alerte cours (variation > 5% sur une position détenue)

### IA
- [x] Chat Gemini avec contexte portfolio complet injecté en system prompt

### Page Investir
- [x] Courtiers/plateformes avec liens affiliés et logos

---

## Bugs connus / limites

| Sujet | Description | Statut |
|-------|-------------|--------|
| RealT community API | Retourne 403 depuis Vercel — prix via Blockscout `exchange_rate` | Contournement en place |
| XDAI ticker | Non reconnu par Yahoo Finance — prix Gnosis natif non résolu | À corriger |
| Brave browser | Bloque les notifications push (AbortError) — user doit whitelister | Connu, pas de fix |
| Prix actions européennes | ISINs européens peuvent être en retard (cache 5 min `prices_cache`) | Normal |
| Logos actions/ETF | Certains tickers absents de Logo.dev → pas de logo | Couverture ~95% |
| Yahoo Finance rate limits | L'API non-officielle peut bloquer (429) sous charge → cache atténue | Contournement en place |
| Vercel Hobby limit | Max 12 fonctions serverless (non-underscore) — actuellement 10 | Surveiller |
| CoinGecko dépréciation | L'API v3 sans clé est de plus en plus limitée | À surveiller |
| Capacitor mobile | Build Android/iOS déclaré dans package.json mais pas encore configuré/testé | Non validé |

---

## Décisions techniques importantes

### 1. `user_data` — une seule ligne JSON par profil
Toutes les données (transactions, investissements, objectifs…) sont sérialisées en JSONB dans une seule ligne par utilisateur. Avantage : 0 JOIN, sauvegarde atomique. Inconvénient : pas de queries SQL partielles, taille limitée par Supabase (~1 MB recommandé).

### 2. Snapshots patrimoine — double source
`patrimoine_history` reçoit des inserts de deux sources :
- **`source: 'frontend'`** : envoyé par le frontend après calcul live (prix frais, toutes positions) — plus précis.
- **`source: 'cron'`** : calculé par `cron-prices.js` STEP6 à partir de `prices_cache` — server-side, sans dépendance au client.

**Priorité** : si un snapshot `frontend` existe pour l'heure courante, le cron ne l'écrase pas. Le cron skip également si < 45 min depuis le dernier snapshot cron ET variation < 0.5%. Index unique `(user_id, recorded_at)` empêche les doublons.

### 3. Prix : cron → prices_cache → frontend
Le cron rafraîchit `prices_cache` toutes les heures via Yahoo Finance/CoinGecko. Le frontend lit ces prix via `/api/prices?tickers=...` (avec cache Upstash 15 min). Évite d'appeler Yahoo Finance depuis le navigateur (CORS, rate limits).

### 4. Logos — cascade
Logos actifs : favicons Google (`https://www.google.com/s2/favicons?sz=32&domain=...`) pour les enveloppes → Logo.dev ticker API (`img.logo.dev/ticker/{ticker}`) pour les positions → Yahoo Finance search icon comme dernier fallback. Couvre ~95% des cas.

### 5. Notifications push — Web Push VAPID
Service Worker `/service-worker.js` avec headers `no-cache` dans `vercel.json`. Abonnements stockés en `push_subscriptions`. Fonctionne sur iPhone Safari et Chrome desktop/Android. Brave bloque (AbortError côté client, pas de fix possible sans action user).

### 6. Parrainage — code unique à la connexion
Code parrainage généré côté frontend au premier login (`referral_code` dans `user_data`). Persisté en base. Le filleul entre le code à l'inscription → `referred_by` renseigné → `referrals` row créée → `pro_bonus_months` incrémenté pour parrain et filleul.

### 7. Stablecoin fallback dans `crypto-wallet.js`
Blockscout retourne parfois `exchange_rate: null` pour les stablecoins (USDC, USDT, DAI…). Fix : `parseFloat(token.exchange_rate)` + liste `STABLECOINS` → fallback $1 si exchange_rate invalide.

### 8. `formatCompact` local dans Projection
Fonction locale `formatCompact(n)` dans `Projection.jsx` pour les grands nombres (M€, k€) sans modifier le `fEur` global.

### 9. Wallet EVM — champ `adresse` de l'enveloppe
L'adresse wallet EVM est stockée dans `portfolioForm.adresse` (inutilisé pour Crypto). Validation `^0x[0-9a-fA-F]{40}$` conditionne l'affichage du bouton "Sync wallet".

### 10. Sync wallet — merge sans suppression
`syncCwallet` met à jour `shares` + `currentPrice` des tickers existants et ajoute les nouveaux. Les positions manuelles sont préservées.

### 11. Rebalancing — localStorage pour les cibles
Pourcentages cibles sauvegardés en `localStorage` (`capitaly_rebalancing_target`), pas en Supabase. Évite une migration de schéma. À migrer si la feature devient critique.

### 12. Vercel Functions — préfixe underscore
Les fichiers `api/_*.js` ne créent pas de routes HTTP et ne consomment pas de slots dans la limite de 12.

### 13. Notifications — push only
Les toasts in-app ont été supprimés. Seules les notifications Web Push (background) sont conservées.

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

---

## Monétisation

### Modèle freemium

**FREE — 0€**
- Max 3 enveloppes d'investissement
- Max 5 objets matériels
- Max 5 articles en vente
- 1 profil utilisateur
- Prix automatiques actions/ETF/crypto
- Budget & Objectifs
- Flux de transactions
- Historique graphique illimité
- Notifications push basiques (rappel inactivité uniquement)
- IA — 3 questions/jour (pas d'analyse complète)

**PRO MENSUEL — 7,99€/mois**
**PRO ANNUEL — 59,99€/an (4,99€/mois, -37%)**
**PRO À VIE — 149€ (une seule fois)**

Fonctionnalités Pro :
- Enveloppes illimitées
- Objets matériels illimités
- Articles en vente illimités
- Profils multiples (conjoint, enfant...)
- Import wallet crypto automatique
- Import wallet RealT automatique
- Notifications push avancées (dividendes, paliers, alertes cours)
- Veille marché & actualités financières
- Liens affiliés partenaires
- Simulateur & Projection avancés
- Récap fiscal annuel
- Rebalancing avec calculs
- Calendrier dividendes complet
- IA illimitée + analyse complète patrimoine
- Export PDF/Excel

### Système de parrainage
- Code unique par utilisateur (ex: ALEX2026), généré au premier login
- Parrain → 1 mois Pro gratuit par filleul ayant souscrit
- Filleul → 1 mois Pro gratuit à l'inscription
- Pas de limite de parrainages cumulables
- Persisté en `referrals` + `pro_bonus_months` dans `user_data`

### Paiement
- Web (capitaly.fr) → Stripe
- iOS App Store → Apple In-App Purchase (30% commission Apple)
- Android Google Play → Google Play Billing (30% commission)
- Stratégie : encourager l'abonnement via le web pour éviter les commissions

### Publication stores
- Google Play → TWA (Trusted Web Activity) — wrapper de la PWA
- App Store → PWABuilder ou Capacitor
- À implémenter quand l'app sera stable et sans bugs majeurs

### Tables Supabase à créer (monétisation)
- `subscriptions` : `user_id, plan (free/pro_monthly/pro_annual/pro_lifetime), status, stripe_customer_id, stripe_subscription_id, current_period_end`
