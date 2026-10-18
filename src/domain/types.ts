/**
 * Modèle de domaine — Patrimoine.ma
 * Toutes les montants sont exprimés en MAD (devise de référence).
 */

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */

export type InstrumentType = 'ACTION' | 'OPCVM'

export const OPCVM_CATEGORIES = [
  'ACTIONS',
  'OBLIGATAIRE_CT',
  'OBLIGATAIRE_MLT',
  'MONETAIRE',
  'DIVERSIFIE',
  'CONTRACTUEL',
] as const
export type OpcvmCategory = (typeof OPCVM_CATEGORIES)[number]

export interface Instrument {
  id: string
  type: InstrumentType
  /** Code mnémonique (ex: ATW) ou ISIN (ex: MA0000012345) pour les OPCVM */
  ticker: string
  name: string
  /** Secteur (actions) / catégorie affichée */
  sector?: string
  currency: 'MAD'
  isin?: string
  market?: string
  lotSize?: number
  /** Données fonds (OPCVM) */
  managementCompany?: string
  category?: OpcvmCategory
  benchmark?: string
  /** SRRI 1..7 */
  riskLevel?: number
  fees?: { entry: number; exit: number; management: number }
  policy?: string
  active: boolean
}

export interface Quote {
  instrumentId: string
  /** Date de cotation la plus récente disponible (AAAA-MM-JJ) */
  date: string
  close: number
  changePct: number
  volume?: number
  marketCap?: number
  per?: number
  dividendPerShare?: number
  dividendYield?: number
}

export interface PricePoint {
  date: string
  close: number
}

export type IndexCode = 'MASI' | 'MSI20' | 'MASI_BANQUES'

export interface IndexQuote {
  code: IndexCode
  name: string
  value: number
  changePct: number
}

/* ------------------------------------------------------------------ */
/* Portefeuilles & transactions                                        */
/* ------------------------------------------------------------------ */

export interface Portfolio {
  id: string
  userId: string
  name: string
  /** CTO / PEA-RETRAITE / ENFANTS ... purement informatif */
  kind: string
  color: string
  createdAt: string
  note?: string
}

export type TransactionType =
  | 'ACHAT'
  | 'VENTE'
  | 'SOUSCRIPTION'
  | 'RACHAT'
  | 'DIVIDENDE'
  | 'COUPON'
  | 'DEPOT'
  | 'RETRAIT'
  | 'FRAIS'
  | 'SPLIT'
  | 'ATTRIBUTION_GRATUITE'
  | 'AUGMENTATION_CAPITAL'

export interface Transaction {
  id: string
  portfolioId: string
  /** null pour les opérations de trésorerie (dépôt, retrait, frais) */
  instrumentId: string | null
  type: TransactionType
  /** AAAA-MM-JJ */
  date: string
  /** Quantité (ou ratio pour un split, ex: 2 pour 2 pour 1) */
  quantity?: number
  /** Cours ou VL unitaire */
  price?: number
  /** Frais de courtage en MAD */
  fees?: number
  /** Taxes / droits de timbre en MAD */
  taxes?: number
  /** Montant brut (dividendes, coupons, dépôts, retraits, frais) */
  amount?: number
  comment?: string
  createdAt: string
  updatedAt?: string
}

/** Type de flux externe (versement / retrait du portefeuille) */
export type FlowType = 'DEPOT' | 'RETRAIT'

/* ------------------------------------------------------------------ */
/* Positions (vue calculée)                                            */
/* ------------------------------------------------------------------ */

export interface Position {
  portfolioId: string
  instrumentId: string
  type: InstrumentType
  ticker: string
  name: string
  sector?: string
  category?: OpcvmCategory
  quantity: number
  /** Prix de revient unitaire (coût moyen pondéré, frais inclus) */
  pru: number
  /** Coût total détenue */
  cost: number
  lastPrice: number
  priceDate: string
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  dayChangePct: number
  weight: number
  /** Plus-value réalisée cumulée sur la ligne */
  realizedPnl: number
  /** Dividendes / coupons nets encaissés sur la ligne */
  income: number
  invested: number
}

export interface CashSummary {
  deposits: number
  withdrawals: number
  fees: number
  /** Dividendes + coupons nets */
  income: number
  balance: number
}

export interface PortfolioSnapshot {
  portfolioId: string
  positions: Position[]
  cash: CashSummary
  /** Valeur des titres */
  holdingsValue: number
  /** holdingsValue + liquidités */
  totalValue: number
  invested: number
  unrealizedPnl: number
  realizedPnl: number
  dayChangeAbs: number
  dayChangePct: number
}

/* ------------------------------------------------------------------ */
/* Analyse / performance                                               */
/* ------------------------------------------------------------------ */

export type RangeKey = '1J' | '1S' | '1M' | '3M' | '6M' | '1A' | 'MAX'

export interface SeriesPoint {
  date: string
  /** Valeur du portefeuille (ou indice) */
  value: number
  /** Rendement cumulé en % depuis le début de la fenêtre */
  pct: number
}

export interface PerformanceSummary {
  twr: number
  xirr: number | null
  simpleReturn: number
  realizedPnl: number
  unrealizedPnl: number
  dividends: number
  fees: number
  flowsIn: number
  flowsOut: number
}

export interface RiskMetrics {
  volatility: number
  maxDrawdown: number
  worstDay: number
  bestDay: number
  concentration: { instrumentId: string; name: string; weight: number }[]
  maxConcentration: number
  isConcentrated: boolean
}

export interface ContributionRow {
  instrumentId: string
  name: string
  ticker: string
  weight: number
  periodReturn: number
  contribution: number
}

export interface AllocationSlice {
  key: string
  label: string
  value: number
  weight: number
  color: string
}

/* ------------------------------------------------------------------ */
/* Fiscalité                                                           */
/* ------------------------------------------------------------------ */

export interface TaxSettings {
  /** Taux d'imposition des plus-values réalisées sur titres (%) */
  capitalGainsRate: number
  /** Taux de retenue à la source sur dividendes / coupons (%) */
  dividendWithholdingRate: number
  /** Seuil annuel en dessous duquel les plus-values sont exonérées (MAD) */
  exemptionThreshold: number
  /** Année fiscale de référence */
  fiscalYear: number
}

export interface TaxYearSummary {
  year: number
  realizedGains: number
  realizedLosses: number
  taxableGains: number
  capitalGainsTax: number
  grossDividends: number
  withheldDividends: number
  grossCoupons: number
  withheldCoupons: number
  totalTax: number
}

/* ------------------------------------------------------------------ */
/* Alertes & watchlist                                                 */
/* ------------------------------------------------------------------ */

export type AlertType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'DAY_CHANGE'
  | 'VL_PUBLISHED'
  | 'DIVIDEND_DETACH'

export interface Alert {
  id: string
  portfolioId: string | null
  instrumentId: string
  type: AlertType
  threshold: number
  active: boolean
  channels: Array<'IN_APP' | 'EMAIL'>
  createdAt: string
  triggeredAt?: string
}

export interface WatchlistItem {
  id: string
  portfolioId: string | null
  instrumentId: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Événements à venir                                                  */
/* ------------------------------------------------------------------ */

export type CorporateEventType =
  | 'DIVIDEND_DETACH'
  | 'AG'
  | 'VL_PUBLISHED'
  | 'MATURITY'
  | 'CAPITAL'

export interface CorporateEvent {
  id: string
  instrumentId: string
  type: CorporateEventType
  date: string
  label: string
  amount?: number
}

/* ------------------------------------------------------------------ */
/* Utilisateur & préférences                                           */
/* ------------------------------------------------------------------ */

export type Locale = 'fr' | 'en' | 'ar'

export interface UserSettings {
  displayCurrency: 'MAD' | 'EUR' | 'USD'
  /** Frais de courtage par défaut (%) et minimum facturé (MAD) */
  defaultFeePct: number
  defaultFeeMin: number
  tax: TaxSettings
  locale: Locale
  theme: 'light' | 'dark' | 'system'
  maskAmounts: boolean
  twoFactor: 'SMS' | 'EMAIL' | 'OFF'
}

export interface UserProfile {
  id: string
  email: string
  fullName: string
  phone?: string
  createdAt: string
  settings: UserSettings
}
