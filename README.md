# Capitaly

Dashboard de gestion financière personnelle — actifs, épargne, investissements, budget, projections et achats/ventes.

## Stack

- **Frontend** : React 19, Recharts
- **Backend** : Express.js (serveur de prix en temps réel)
- **Prix** : CoinGecko (crypto) + Yahoo Finance (actions/ETF)
- **Données** : localStorage (tout est stocké localement dans le navigateur)

## Installation

### Prérequis

- Node.js ≥ 18
- npm ≥ 9

### 1. Cloner et installer

```bash
git clone <url-du-repo>
cd finlib
npm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Éditez `.env` si nécessaire :

```env
# Développement local (défaut)
REACT_APP_API_URL=http://localhost:3001

# Production : remplacez par l'URL publique de votre serveur Express
# REACT_APP_API_URL=https://api.votre-domaine.com
```

### 3. Lancer en développement

```bash
npm run dev
```

Lance simultanément le frontend React (port 3000) et le serveur de prix Express (port 3001).

Ouvrez [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Frontend + backend en parallèle (développement) |
| `npm start` | Frontend seul |
| `npm run server` | Backend seul (`node server.js`) |
| `npm run build` | Build de production du frontend |

## Build de production

```bash
# 1. Configurez l'URL de production dans .env
echo "REACT_APP_API_URL=https://api.votre-domaine.com" > .env

# 2. Build
npm run build
```

Le dossier `build/` contient le frontend statique à déployer sur Vercel, Netlify, GitHub Pages ou tout hébergeur statique.

Le serveur Express (`server.js`) doit être déployé séparément (Railway, Render, Fly.io, VPS…) et son URL publique renseignée dans `REACT_APP_API_URL` **avant** le build.

## Structure du projet

```
finlib/
├── public/
│   └── logo.png
├── src/
│   └── App.js          # Application React complète (UI + logique)
├── server.js           # Serveur de prix (Express + CoinGecko + Yahoo Finance)
├── .env                # Variables d'environnement (non versionné)
├── .env.example        # Modèle de variables d'environnement
├── package.json
└── README.md
```

## Fonctionnalités

- **Vue d'ensemble** — patrimoine total, score de santé financière, graphiques revenus/dépenses
- **Flux** — transactions, catégories, export CSV, taux d'épargne
- **Épargne & Cash** — comptes courants, livrets réglementés, taux d'intérêt annuels
- **Achats & Ventes** — articles en cours de vente, calcul de bénéfice, historique des ventes
- **Investissements** — portefeuille avec prix en temps réel (crypto + actions/ETF), positions détaillées
- **Patrimoine matériel** — voiture, collections, immobilier physique
- **Budget & Objectifs** — plafonds mensuels par catégorie, objectifs financiers avec progression
- **Projection** — simulation d'intérêts composés sur 1–40 ans

## Notes

- Toutes les données sont sauvegardées dans le `localStorage` du navigateur — aucune donnée personnelle n'est envoyée à un serveur tiers.
- Le serveur Express est uniquement utilisé comme proxy pour les APIs de prix (CoinGecko, Yahoo Finance) afin de contourner les restrictions CORS.
- En cas d'erreur SSL sur réseau d'entreprise, `server.js` désactive la vérification des certificats (`NODE_TLS_REJECT_UNAUTHORIZED=0`). Ne pas utiliser en production sur un réseau public sans évaluer les risques.
