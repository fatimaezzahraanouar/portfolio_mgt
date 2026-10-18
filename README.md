# Patrimoine.ma — Suivi de portefeuille pour investisseurs particuliers (Maroc)

Application web de suivi de patrimoine financier destinée aux investisseurs particuliers au
Maroc : actions cotées à la **Bourse de Casablanca** et **OPCVM** (parts de SICAV / FCP),
toutes les valeurs exprimées en **MAD**.

L'application permet de saisir son historique d'opérations (achats, ventes, souscriptions,
rachats, dividendes, dépôts…), puis calcule automatiquement : positions et prix de revient,
valorisation, performance (TWR / XIRR), fiscalité estimée, risque et répartition.

---

## ⚠️ Avertissement légal

- Il s'agit d'un **outil de suivi et de reporting**, en **lecture seule** : l'application
  **ne passe aucun ordre réel** auprès d'un courtier ou d'une société de gestion et n'est
  **pas un conseil en investissement** ni une recommandation personnalisée.
- Les cours, VL et indices sont **différés** et **fournis à titre indicatif**. Le jeu de
  données embarqué est un jeu de **démonstration déterministe, titulaire** (données réalistes
  mais fictives), à remplacer par un fournisseur de données réel.
- Les montants fiscaux affichés sont des **estimations** : les taux (TPCVM, retenue sur
  dividendes) changent à chaque loi de finances et sont **entièrement paramétrables** dans
  l'écran **Fiscalité**. Seule une déclaration fiscale faite avec l'administration comptable
  fait foi.
- L'utilisateur reste propriétaire de ses données ; l'éditeur décline toute responsabilité
  en cas de décision d'investissement prise sur la base de ces écrans.

---

## Stack technique

| Couche | Technologie |
| --- | --- |
| UI | React 19 + TypeScript (strict) |
| Build | Vite 8 (`tsc -b && vite build`) |
| Styles | Tailwind CSS v4 (plugin `@tailwindcss/vite`) |
| Composants | Style shadcn/ui sur la base de Radix UI (`src/components/ui`) |
| Graphiques | Recharts 3 |
| Routage | React Router 7 (`react-router-dom`) |
| Formats / dates | `date-fns` 4, `clsx`, `tailwind-merge`, `class-variance-authority`, icônes `lucide-react` |
| Tests | Vitest 5 (+ `@vitest/coverage-v8`, environnement `node`) |
| Lint | Oxlint (`npm run lint`) |
| Backend cible | **Supabase** : Postgres + Auth + Row Level Security (`SupabaseDataProvider`, schéma dans `docs/supabase-schema.sql`) |

---

## Prérequis

- **Node.js ≥ 20** (module `node:url`, `fetch` natif attendus).
- Sur **Windows** : si Node n'est pas installé globalement, un build portable peut être placé
  dans `%LOCALAPPDATA%\nodejs` ; ajoutez ce dossier au `PATH` de session :

  ```powershell
  $env:Path = "$env:Path;$env:LOCALAPPDATA\nodejs"
  node -v   # >= v20
  ```

---

## Démarrage rapide

```bash
npm install        # installation des dépendances
npm run dev        # serveur de développement → http://localhost:5173
npm run build      # vérification TypeScript (tsc -b) + build de production (vite build)
npm run preview    # sert le build de production (dist/)
npm run lint       # analyse statique (Oxlint)
npx vitest run     # tests unitaires (voir section « Tests »)
```

> **Scripts** (tels que définis dans `package.json`) : `dev`, `build`, `lint`, `preview`.
> Il n'existe pas encore de script `test` ni `typecheck` : les tests s'exécutent avec
> `npx vitest run` (ou `npx vitest` en mode veille) et le typage avec `npx tsc -b`.

**Mode démonstration** : aucun compte n'est nécessaire. L'authentification est simulée
(`src/state/auth.tsx`) — le **code OTP de démonstration est `426831`** (il est aussi affiché
sur l'écran OTP). Les données du portefeuille de démonstration sont persistées dans le
`localStorage` sous le préfixe `patrimoine.ma/v1/` ; le bouton de réinitialisation est
fourni par `resetDemo()` du store.

---

## Fonctionnalités

- Tableau de bord : valeur totale, variation du jour, donut de répartition, courbe de
  valorisation, bandeau indices (MASI, MSI20, MASI Banques), événements à venir.
- Actions et OPCVM : listes triables, fiche valeur, watchlist.
- Journal d'opérations : 12 types d'opérations (achat/vente, souscription/rachat, dividende,
  coupon, dépôt, retrait, frais, split, attribution gratuite, augmentation de capital),
  **ajout / modification / suppression**, filtres (nature, portefeuille, valeurs, période),
  **import CSV avec mapping des colonnes** et export CSV / impression PDF.
- Analyse : TWR, XIRR, rendement simple, contributions par ligne, volatilité, drawdown,
  concentration.
- Fiscalité : récapitulatif par année (plus-values réalisées, dividendes/coupons, impôt
  estimé), taux paramétrables.
- Alertes (cours, variation journalière, publication de VL) et watchlist.
- Simulation d'épargne, profil/utilisateur (devise d'affichage, masque des montants, langue,
  thème, 2FA).
- Multi-langue : **français, anglais, arabe (avec RTL)** ; thème clair/sombre/système.

---

## Structure du projet

```text
.
├── docs/
│   ├── ARCHITECTURE.md          # vue en couches, flux de données, contrat DataProvider
│   └── supabase-schema.sql      # schéma Postgres complet (tables, vues, RLS, triggers)
├── index.html
├── package.json
├── vite.config.ts               # plugins React + Tailwind, alias '@' → ./src, config Vitest
├── tsconfig.app.json            # TypeScript strict, JSX react-jsx, alias '@/*'
└── src/
    ├── main.tsx                 # point d'entrée React (racine + <App/>)
    ├── App.tsx                  # providers (i18n, préférences, toasts, auth, store) + routes
    ├── index.css                # Tailwind v4 + variables de thème (clair/sombre)
    ├── domain/                  # ★ MOTEUR MÉTIER — pur, sans dépendance UI
    │   ├── types.ts             # modèle de domaine : Instrument, Quote, Transaction,
    │   │                        #   Position, PortfolioSnapshot, TaxSettings, Alert…
    │   └── calc/
    │       ├── positions.ts     # buildSnapshot : journal → positions (PRU/CMP, plus-values)
    │       ├── performance.ts   # buildValueSeries, TWR, rebase (comparaison indice)
    │       ├── xirr.ts          # XIRR (Newton-Raphson + bissection), extraction des flux
    │       ├── risk.ts          # volatilité annualisée, drawdown, concentration, Sharpe
    │       ├── tax.ts           # fiscalité paramétrable (plus-values, retenues)
    │       ├── allocation.ts    # répartition classes d'actifs / secteurs, contributions
    │       ├── index.ts         # réexport du moteur
    │       └── *.test.ts        # tests unitaires (Vitest)
    ├── data/
    │   ├── demo/                # jeu de démonstration DÉTERMINISTE (PRNG à graine)
    │   │   ├── constants.ts     # DATA_AS_OF, DATA_START, mulberry32, businessDays…
    │   │   ├── instruments.ts   # 14 actions (ATW, BCP, IAM…) + 12 OPCVM (OPC_*) — titulaires
    │   │   ├── market.ts        # séries de cours/VL générées, indices, quoteOf/quoteOfFund
    │   │   ├── transactions.ts  # SEED_USER, SEED_PORTFOLIOS, SEED_TRANSACTIONS
    │   │   ├── engagement.ts    # SEED_EVENTS (détachements, AG), SEED_WATCHLIST, SEED_ALERTS
    │   │   └── sanity.test.ts   # test de cohérence du jeu de données
    │   ├── provider/            # ★ COUCHE DataProvider (abstraction des sources)
    │   │   ├── types.ts         # interface DataProvider + uid()
    │   │   ├── demo.ts          # DemoDataProvider (localStorage + latence simulée)
    │   │   ├── supabase.ts      # SupabaseDataProvider (injecte un client « SupabaseLike »)
    │   │   └── index.ts         # fabrique (createDataProvider/getProvider/setProvider) +
    │   │                        #   BaseRestProvider (gabarit d'adaptateur REST)
    │   └── storage.ts           # helper localStorage préfixé 'patrimoine.ma/v1/'
    ├── state/
    │   ├── auth.tsx             #AuthProvider/… : session simulée + OTP de démonstration
    │   ├── preferences.tsx      # thème clair/sombre/système + masque des montants
    │   └── store.tsx            # StoreProvider : chargement via provider + sélecteurs dérivés
    ├── i18n/
    │   ├── index.tsx            # I18nProvider, t(), RTL automatique (dir=rtl pour 'ar')
    │   └── locales/             # fr.ts (référence), en.ts, ar.ts
    ├── components/
    │   ├── ui/                  # primitives style shadcn/ui (Radix) : button, card, dialog,
    │   │                        #   table, select, tabs, toast, badge, alert, controls…
    │   ├── layout/              # AppShell, Sidebar, Topbar, BottomNav
    │   └── shared/              # Money (masque des montants), StatCard, charts, page,
    │                            #   portfolio-tabs, update-price-dialog, watch-button
    ├── lib/
    │   ├── format.ts            # formatMoney/formatPct/formatNumber/formatDate (locales)
    │   ├── export.ts            # downloadCsv (UTF-8 BOM), printPdf
    │   └── utils.ts             # cn() (clsx + tailwind-merge)
    └── pages/
        ├── DashboardPage.tsx
        ├── actions/             # ActionsPage, ActionDetailPage
        ├── opcvm/               # OpcvmPage, FundDetailPage
        ├── operations/          # OperationsPage (journal d'opérations)
        ├── analyse/             # AnalysePage (performance, risque, contributions)
        ├── fiscalite/           # FiscalitePage (récap. par année + paramètres de taux)
        ├── alertes/             # AlertesPage
        ├── simulation/          # SimulationPage
        ├── profil/              # ProfilPage (préférences, sécurité)
        └── auth/                # LoginPage, RegisterPage, OtpPage
```

Routes (`src/App.tsx`) : `/` (tableau de bord), `/actions`, `/actions/:id`, `/opcvm`,
`/opcvm/:id`, `/operations`, `/analyse`, `/fiscalite`, `/alertes`, `/simulation`,
`/profil`, protégées par `RequireAuth` (redirection vers `/login` sinon).

---

## Règles de calcul

Toutes les règles sont implémentées dans `src/domain/calc/*` et couvertes par des tests.
Le moteur est **pur** (aucune dépendance UI ni réseau) : il transforme le journal
d'opérations en positions, séries et métriques.

### Prix de revient (PRU) — coût moyen pondéré (CMP)

- À chaque **ACHAT / SOUSCRIPTION / AUGMENTATION_DE_CAPITAL** :
  `coût += quantité × cours + frais + taxes` ; `PRU = coût / quantité`
  (`weightedAverageCost`, `buildSnapshot` — les **frais et taxes sont intégrés** au revient).
- **VENTE / RACHAT** : la plus-value réalisée de la vente est
  `(produit net − frais − taxes) − PRU × quantité vendue` ; le **coût résiduel** diminue
  d'autant (sortie au PRU). Quand tout est vendu, la ligne est clôturée.
- **SPLIT** (détail en action) : `quantité × ratio`, le PRU est divisé par le même ratio.
- **ATTRIBUTION GRATUITE** : la quantité augmente, le coût total est inchangé → le PRU baisse.
- **AUGMENTATION DE CAPITAL** est traitée comme un apport (quantité + coût augmentent).
- **DIVIDENDE / COUPON** : alimentent la trésorerie pour le montant net
  (`montant brut − retenue`), sans effet sur le PRU.
- **Dépôt / Retrait / Frais** : flux de trésorerie ; `instrument_id` est nul.

### Valorisation

- **Plus-value latente** = `(cours actuel − PRU) × quantité`
  (`unrealizedPnl`).
- **Plus-value réalisée** : calculée à **chaque vente** et cumulée par ligne
  (`realizedEventsOf`, colonne `realizedPnl`).
- **Actions** : valorisation au dernier cours de `prices`.
- **OPCVM** : valorisation = `parts × dernière VL publiée`. La VL est hebdomadaire dans le
  jeu de démo (publications du vendredi, `VL_DATES` dans `src/data/demo/market.ts`) et la
  **date affichée est celle de la VL effective (J ou J+1)** (`navDate` des spécifications de
  fonds, `src/data/demo/instruments.ts`).
- Poids d'une ligne = `valeur de marché / valeur totale du portefeuille (titres + liquidités)`.

### Performance

- **TWR** (Time-Weighted Return) : série de valorisation jour par jour
  (`buildValueSeries`) où les **flux externes (dépôts/retraits) sont neutralisés** :
  `rendement_j = (valeur_j − flux_j) / valeur_{j−1} − 1`, puis chaînage géométrique
  (`timeWeightedReturn`). Annualisation si la fenêtre > 30 jours.
- **XIRR** (taux interne annualisé) : flux externes (versements négatifs, retraits
  positifs) **+ valeur terminale** à la date de valorisation ; **date de référence = date la
  plus ancienne** des flux (convention XIRR), résolution par **Newton-Raphson avec repli par
  bissection** (`src/domain/calc/xirr.ts`). Retourne `null` si non convergent.
- **Rendement simple** = `(valeur actuelle + retraits − versements) / versements`
  (`computePerformance → simpleReturn`).
- `rebase()` rebase une série d'indice (ex. MASI) sur la même fenêtre pour la comparaison.

### Fiscalité (paramétrable)

`summarizeTaxYear(transactions, settings)` produit un récapitulatif **par année fiscale** :

- plus-values réalisées (gains / pertes) issues des ventes, puis
  `imposable = max(0, gains_nets − seuil d'exonération)` ;
- **TPCVM** : `impôt = imposable × taux_plus_value` ;
- **retenue à la source** recalculée au taux courant sur dividendes et coupons bruts ;
- taux par défaut du jeu de démo : 10 % plus-values, 15 % dividendes/coupons, seuil 0 MAD —
  **modifiables dans l'écran Fiscalité** (`TaxSettings`, `capitalGainsRate`,
  `dividendWithholdingRate`, `exemptionThreshold`, `fiscalYear`).

### Risque

- **Volatilité annualisée** : `écart-type des rendements journaliers × √252`
  (`annualizedVolatility`).
- **Drawdown maximal** : creux le plus profond par rapport au plus haut
  (`maxDrawdown`, série `drawdownSeries`).
- **Concentration** : liste des 5 plus gros poids ; alerte si le poids maximum
  **dépasse 20 %** du portefeuille (`computeRisk`, `concentrationThreshold` par défaut 20).
- Ratio de Sharpe simplifié, taux sans risque paramétrable (défaut 3 %).

### Allocation

`buildAllocation` regroupe par **classe d'actifs** (Actions, OPCVM Actions, Obligataires,
Monétaires, Diversifiés, Liquidités — la catégorie OPCVM détermine la classe) ;
`buildSectorAllocation` répartit les actions par secteur ;
`computeContributions` estime la contribution de chaque ligne (poids × rendement de période).

---

## Schéma de données

Le schéma Postgres complet (tables, contraintes, vues `v_latest_quotes` et `v_positions`,
politiques **RLS**, triggers d'audit et de création de profil) est fourni dans
**[`docs/supabase-schema.sql`](docs/supabase-schema.sql)** et se branche tel quel avec le
`SupabaseDataProvider` (`src/data/provider/supabase.ts`) :

| Table SQL | Rôle |
| --- | --- |
| `profiles` | profil 1-1 avec `auth.users` (e-mail, nom, téléphone, `settings` JSON) |
| `portfolios` | portefeuilles de l'utilisateur (CTO, PEA…) |
| `instruments` | référentiel : `type IN ('ACTION','OPCVM')` + colonnes OPCVM (`management_company`, `category`, `benchmark`, `risk_level`, `fees` JSON, `policy`) |
| `prices` | cours/VL historiques, PK `(instrument_id, date)`, `source IN ('market','manual','nav')` |
| `transactions` | journal des opérations (12 types), `instrument_id` NULL pour dépôt/retrait/frais |
| `dividends` | suivi des dividendes (brut, retenue, net) |
| `alerts` / `watchlists` | alertes de cours et listes de suivi |
| `corporate_events` | détachements, AG, publications de VL à venir |
| `indices` / `index_prices` | MASI, MSI20, MASI Banques |
| `audit_log` | journal d'audit en écriture seule pour l'utilisateur |
| `v_latest_quotes` (vue) | dernier cours + variation % par instrument |
| `v_positions` (vue) | positions recalculées en SQL depuis `transactions` (PRU, quantité, coût, valorisation) |

---

## Intégration d'une API de cours réelle

### (a) Le principe : l'interface `DataProvider`

Toute la donnée (référentiel, cours, VL, opérations, alertes) transite par une seule
interface, définie dans **`src/data/provider/types.ts`** :

```ts
export interface DataProvider {
  readonly id: string
  readonly label: string
  readonly disclaimer: string

  /* Référentiel */
  listInstruments(): Promise<Instrument[]>
  getInstrument(id: string): Promise<Instrument | null>

  /* Cours & VL */
  getPriceHistory(instrumentId: string): Promise<PricePoint[]>
  getPriceHistories(instrumentIds?: string[]): Promise<Map<string, PricePoint[]>>
  getQuotes(instrumentIds?: string[]): Promise<Quote[]>
  getIndexQuotes(): Promise<IndexQuote[]>
  getIndexHistory(code: IndexCode): Promise<PricePoint[]>
  updateQuote(instrumentId: string, price: number, date: string): Promise<Quote | null>
  listManualOverrides(): Array<{ instrumentId: string; price: number; date: string }>

  /* Portefeuilles & opérations */
  listPortfolios(userId: string): Promise<Portfolio[]>
  listTransactions(portfolioId: string): Promise<Transaction[]>
  listAllTransactions(): Promise<Transaction[]>
  saveTransaction(tx: Transaction): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>

  /* Alertes & watchlist */
  listCorporateEvents(from?: string, to?: string): Promise<CorporateEvent[]>
  listWatchlist(portfolioId: string | null): Promise<WatchlistItem[]>
  saveWatchlist(item: WatchlistItem): Promise<WatchlistItem>
  deleteWatchlist(id: string): Promise<void>
  listAlerts(portfolioId: string | null): Promise<Alert[]>
  saveAlert(alert: Alert): Promise<Alert>
  deleteAlert(id: string): Promise<void>

  /* Profil */
  getUser(userId: string): Promise<UserProfile | null>
  saveUser(user: UserProfile): Promise<UserProfile>
}
```

La fabrique `src/data/provider/index.ts` expose `createDataProvider()`, `getProvider()`,
`setProvider(provider)` et `resetProvider()`. Par défaut (`VITE_DATA_PROVIDER=demo` non
défini ou `demo`), le `DemoDataProvider` est utilisé. Changer de source de données ne
demande **aucune modification de l'UI ni du moteur de calcul**.

### (b) Brancher Supabase

1. Installer le client officiel :

   ```bash
   npm i @supabase/supabase-js
   ```

2. Exécuter `docs/supabase-schema.sql` dans l'éditeur SQL Supabase (voir l'en-tête du
   fichier).

3. Créer un fichier `.env.local` à la racine :

   ```bash
   VITE_DATA_PROVIDER=supabase
   VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
   VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON
   ```

4. Injecter le client dans `src/main.tsx`, **avant** le rendu de `<App />` :

   ```ts
   import { createClient } from '@supabase/supabase-js'
   import { setProvider, SupabaseDataProvider } from '@/data/provider'

   setProvider(
     new SupabaseDataProvider(
       createClient(
         import.meta.env.VITE_SUPABASE_URL as string,
         import.meta.env.VITE_SUPABASE_ANON_KEY as string,
       ),
     ),
   )
   ```

   `SupabaseDataProvider` accepte n'importe quel objet compatible `SupabaseLike`
   (`from().select/insert/update/delete`) : aucun `@types` n'est requis à la compilation, et
   l'authentification réelle (Supabase Auth, OTP e-mail/SMS) remplace la session simulée de
   `src/state/auth.tsx`. Le cloisonnement des données est assuré côté base par le **Row
   Level Security** (voir `docs/supabase-schema.sql`).

### (c) Écrire un adaptateur REST maison

`src/data/provider/index.ts` fournit la classe abstraite **`BaseRestProvider`** : elle
implémente déjà `DataProvider`, stocke `baseUrl`/`apiKey` et offre un helper `get<T>()`
(avec en-tête `Authorization: Bearer …` et gestion des erreurs HTTP). Il reste à implémenter
chaque méthode, typiquement 1:1 avec les endpoints suivants :

```text
GET /instruments        → listInstruments(), getInstrument()
GET /prices?ids=…       → getPriceHistory(), getPriceHistories()
GET /quotes             → getQuotes(), updateQuote()
GET /indices            → getIndexQuotes(), getIndexHistory()
GET /navs?fund=…        → valorisation OPCVM (dernière VL + historique)
GET /events             → listCorporateEvents()
```

Gabarit :

```ts
import { BaseRestProvider, setProvider } from '@/data/provider'

export class RestMarketDataProvider extends BaseRestProvider {
  readonly id = 'rest-marche'
  readonly label = 'API de marché (REST)'
  readonly disclaimer = 'Cours différés — données fournies par un tiers'

  constructor(baseUrl: string, apiKey?: string) {
    super(baseUrl, apiKey)
  }

  async listInstruments() {
    return this.get<Instrument[]>('/instruments')
  }
  // …implémenter les autres méthodes de DataProvider
}

setProvider(new RestMarketDataProvider('https://api.example.ma/v1'))
```

### (d) Sources possibles au Maroc

- **Bourse de Casablanca** (bourse-casablanca.com) : cours et volumes des actions cotées,
  généralement en **différé** pour le grand public ; fichiers/flux officiels selon les
  contrats de diffusion.
- **ASFIM** (Autorité fiduciaire et marché) et **sociétés de gestion** (Wafa Gestion,
  Atlas Gestion, CFG Valeurs, Saham, BRISA…) : **VL quotidiennes/hebdomadaires des OPCVM**,
  souvent publiées sous forme de fichiers ou pages de fonds.
- **Agrégateurs tiers** (APIs financières régionales ou mondiales couvrant le marché
  marocain) : commodité payante, couverture parfois incomplète des OPCVM.

> **Mention obligatoire** : avant tout branchement, **respecter les conditions
> d'utilisation et la licence de diffusion** du fournisseur (rediffusion, cache, usage
> commercial). Certaines données ne peuvent pas être redistribuées ; affichez toujours la
> mention de source et le caractère différé des cours dans l'UI (champ `disclaimer` du
> `DataProvider`).

---

## Mise à jour manuelle des cours / VL

Tant qu'aucun fournisseur temps réel n'est branché, l'utilisateur peut saisir lui-même un
cours (action) ou une VL (OPCVM) :

- **UI** : composant partagé `src/components/shared/update-price-dialog.tsx`
  (`UpdatePriceDialog`, bouton « Mettre à jour » — clés i18n `common.update` /
  `actions.updatePrice`), posé sur les fiches valeur `/actions/:id` et `/opcvm/:id`. Il
  demande un **prix en MAD** et une **date**.
- **Store** : `useStore().updatePrice(instrumentId, price, date)`
  → `provider.updateQuote(instrumentId, price, date)`, puis rechargement automatique des
  données.
- **Provider démo** (`src/data/provider/demo.ts`) : la valeur manuelle est stockée comme
  *override* dans le `localStorage`, remplace le dernier point de l'historique et recalcule
  la variation journalière (`listManualOverrides()` les expose).
- **Provider Supabase** : la saisie est insérée dans la table `prices` avec
  `source = 'manual'` (helper SQL `set_manual_price()` fourni dans le schéma, qui fait un
  *upsert*). Les lignes manuelles portent le `user_id` de leur auteur et sont protégées par
  RLS.

---

## Tests

Les tests utilisent **Vitest** (configuration dans `vite.config.ts` : environnement `node`,
fichiers `src/**/*.test.ts`, alias `@` → `src`). Exécution : `npx vitest run`.

Fichiers de tests existants :

| Fichier | Contenu |
| --- | --- |
| `src/domain/calc/positions.test.ts` | PRU/CMP (frais & taxes inclus, second achat, split, attribution gratuite), plus-values latente/réalisée, clôture de ligne, trésorerie, poids |
| `src/domain/calc/performance.test.ts` | XIRR (rendement simple, annualisation 6 mois, versements successifs, cas non convergents), neutralisation des flux dans le TWR, agrégation des opérations du jour, rendement simple, tranches de série |
| `src/domain/calc/tax.test.ts` | fiscalité (plus-values par année, retenues, seuil d'exonération) **et** risque (drawdown, volatilité annualisée, concentration > 20 %, Sharpe) |
| `src/data/demo/sanity.test.ts` | cohérence du jeu de démo : portefeuilles positifs, couverture des classes d'actifs, tous les cours/VL positifs |

Pour ajouter un test : créer un fichier `*.test.ts` à côté du code testé (dossier
`src/domain/calc/`, `src/data/demo/`…) :

```ts
import { describe, expect, it } from 'vitest'
import { weightedAverageCost } from '@/domain/calc/positions'

describe('PRU', () => {
  it('divise le coût par la quantité', () => {
    expect(weightedAverageCost(1050, 10)).toBe(105)
  })
})
```

---

## Sécurité & conformité

- **Chiffrement en transit** : tout le trafic Supabase est en **TLS/HTTPS** ; la clé `anon`
  est publique et n'autorise que ce que les politiques RLS autorisent.
- **Chiffrement at-rest** : les bases Supabase sont chiffrées sur disque (gestion
  d'infrastructure du fournisseur) ; sauvegardes chiffrées.
- **Row Level Security par utilisateur** : chaque table applicative porte un `user_id` et
  une politique `USING (auth.uid() = user_id)` (`docs/supabase-schema.sql`) — une requête
  ne peut jamais lire les données d'un autre utilisateur, même avec la clé `anon`.
- **Journal d'audit** : table `audit_log` alimentée par trigger sur chaque `INSERT`,
  `UPDATE`, `DELETE` de `transactions` ; pour l'utilisateur, la table est **en écriture
  seule** (INSERT + SELECT de ses propres lignes, pas de UPDATE/DELETE).
- **Profil & authentification** : `profiles` en 1-1 avec `auth.users` (création par
  trigger à l'inscription), mots de passe gérés par Supabase Auth ; le mode démo simule un
  OTP (`src/state/auth.tsx`).
- **Confidentialité côté UI** : bouton « masquer les montants »
  (`src/state/preferences.tsx` + composant `Money`, classe `amount-masked`) pour les
  écrans partagés en public ; préférences stockées localement.
- **Mention légale** : outil de suivi, pas un conseil en investissement — voir
  l'avertissement en tête de ce README, à reproduire dans toute version déployée.

---

## Feuille de route

- [ ] **Notifications push** pour les alertes (aujourd'hui `IN_APP` / `EMAIL` dans les
      données ; canaux à dispatcher côté Supabase : Edge Functions + Web Push / e-mail).
- [x] **Import bancaire / relevé CSV** : parseur de relevés vers `saveTransaction`, avec
      **mapping des colonnes assisté** (détection du séparateur `;` / `,`, guillemets,
      devinettes d'en-têtes, aperçu et import en masse) — écran **Journal des opérations**,
      bouton « Importer CSV / Excel » + modèle CSV téléchargeable.
- [ ] **Multi-devises** : la devise d'affichage (`displayCurrency` : MAD/EUR/USD) existe
      dans le profil ; ajouter un taux de conversion et la valorisation convertie.
- [ ] **Export comptable** : liasse annuelle (fiscalité + opérations) en PDF/CSV prête pour
      le comptable, réutilisant `printPdf()` et `downloadCsv()`.
- [x] **Fiches valeur & OPCVM** : `/actions/:id` et `/opcvm/:id` complètes (cours/VL,
      historique + plage, indicateurs clés, ma position, mes opérations, watchlist,
      mise à jour manuelle du cours/VL).
- [ ] **Journal enrichi** : rapprochement bancaire (import automatique, doublons), pièces
      jointes justificatives, édition en masse.

---

## Licence & contribution

Projet interne en cours de développement. Les données de démonstration sont **titulaires** :
ne pas les utiliser comme source d'information de marché réelle.
