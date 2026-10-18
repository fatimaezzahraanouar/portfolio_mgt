import type {
  Alert,
  CorporateEvent,
  IndexCode,
  IndexQuote,
  Instrument,
  Portfolio,
  PricePoint,
  Quote,
  Transaction,
  UserProfile,
  WatchlistItem,
} from '@/domain/types'

/**
 * Couche d'abstraction « DataProvider ».
 *
 * Toutes les données (cours de la Bourse de Casablanca, VL d'OPCVM,
 * référentiel, opérations) transitent par cette interface. Le jeu de
 * démonstration est branché aujourd'hui ; demain, une API réelle
 * (Bourse de Casablanca, ASFIM, sociétés de gestion, ou un agrégateur)
 * se branche en implémentant cette même interface — voir
 * `src/data/provider/supabase.ts` et `docs/supabase-schema.sql`.
 */
export interface DataProvider {
  readonly id: string
  readonly label: string
  /** Mention d'information à afficher dans l'UI */
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
  /** Mise à jour manuelle d'un cours / d'une VL par l'utilisateur */
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

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, hint: string) {
    super(`Le fournisseur de données « ${provider} » n'est pas configuré. ${hint}`)
    this.name = 'ProviderNotConfiguredError'
  }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
