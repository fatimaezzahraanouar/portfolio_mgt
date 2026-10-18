import { DemoDataProvider } from './demo'
import { SupabaseDataProvider } from './supabase'
import { ProviderNotConfiguredError, type DataProvider } from './types'

export * from './types'
export { DemoDataProvider } from './demo'
export { SupabaseDataProvider } from './supabase'
export type { SupabaseLike, SupaQuery, SupaResult } from './supabase'

let instance: DataProvider | null = null

/**
 * Fabrique du DataProvider.
 *
 * - `VITE_DATA_PROVIDER=demo` (défaut) → jeu de démonstration
 * - `VITE_DATA_PROVIDER=supabase` → nécessite d'injecter le client réel,
 *   voir « Intégration d'une API de cours » dans le README :
 *
 *   import { createClient } from '@supabase/supabase-js'
 *   import { setProvider, SupabaseDataProvider } from '@/data/provider'
 *   setProvider(new SupabaseDataProvider(createClient(url, anonKey)))
 */
export function createDataProvider(): DataProvider {
  if (instance) return instance

  const mode = import.meta.env.VITE_DATA_PROVIDER ?? 'demo'
  if (mode === 'supabase') {
    throw new ProviderNotConfiguredError(
      'supabase',
      "Installez @supabase/supabase-js puis injectez le client : setProvider(new SupabaseDataProvider(createClient(url, key))).",
    )
  }

  instance = new DemoDataProvider()
  return instance
}

export function getProvider(): DataProvider {
  return createDataProvider()
}

/** Injection explicite d'un fournisseur (Supabase, API Bourse de Casablanca…) */
export function setProvider(provider: DataProvider): void {
  instance = provider
}

/** Réinitialise la fabrique (tests / réinitialisation de la démonstration) */
export function resetProvider(): void {
  instance = null
}

/**
 * Adaptateur d'exemple pour une API REST de cours (Bourse de Casablanca,
 * ASFIM, agrégateur tiers). À utiliser comme gabarit :
 *
 *   export class RestMarketDataProvider extends BaseRestProvider { ... }
 *   setProvider(new RestMarketDataProvider({ baseUrl: 'https://api…' }))
 *
 * Les méthodes de `DataProvider` correspondent 1:1 aux endpoints à exposer :
 * GET /instruments, GET /prices?ids=…, GET /quotes, GET /indices,
 * GET /navs?fund=…, GET /events.
 */
export abstract class BaseRestProvider implements DataProvider {
  abstract readonly id: string
  abstract readonly label: string
  abstract readonly disclaimer: string

  protected baseUrl: string
  protected apiKey?: string

  protected constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  protected async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    })
    if (!res.ok) throw new Error(`DataProvider ${this.id} : HTTP ${res.status} sur ${path}`)
    return (await res.json()) as T
  }

  abstract listInstruments(): Promise<import('@/domain/types').Instrument[]>
  abstract getInstrument(id: string): Promise<import('@/domain/types').Instrument | null>
  abstract getPriceHistory(instrumentId: string): Promise<import('@/domain/types').PricePoint[]>
  abstract getPriceHistories(ids?: string[]): Promise<Map<string, import('@/domain/types').PricePoint[]>>
  abstract getQuotes(ids?: string[]): Promise<import('@/domain/types').Quote[]>
  abstract getIndexQuotes(): Promise<import('@/domain/types').IndexQuote[]>
  abstract getIndexHistory(code: import('@/domain/types').IndexCode): Promise<import('@/domain/types').PricePoint[]>
  abstract updateQuote(id: string, price: number, date: string): Promise<import('@/domain/types').Quote | null>
  abstract listManualOverrides(): Array<{ instrumentId: string; price: number; date: string }>
  abstract listPortfolios(userId: string): Promise<import('@/domain/types').Portfolio[]>
  abstract listTransactions(portfolioId: string): Promise<import('@/domain/types').Transaction[]>
  abstract listAllTransactions(): Promise<import('@/domain/types').Transaction[]>
  abstract saveTransaction(tx: import('@/domain/types').Transaction): Promise<import('@/domain/types').Transaction>
  abstract deleteTransaction(id: string): Promise<void>
  abstract listCorporateEvents(from?: string, to?: string): Promise<import('@/domain/types').CorporateEvent[]>
  abstract listWatchlist(portfolioId: string | null): Promise<import('@/domain/types').WatchlistItem[]>
  abstract saveWatchlist(item: import('@/domain/types').WatchlistItem): Promise<import('@/domain/types').WatchlistItem>
  abstract deleteWatchlist(id: string): Promise<void>
  abstract listAlerts(portfolioId: string | null): Promise<import('@/domain/types').Alert[]>
  abstract saveAlert(alert: import('@/domain/types').Alert): Promise<import('@/domain/types').Alert>
  abstract deleteAlert(id: string): Promise<void>
  abstract getUser(userId: string): Promise<import('@/domain/types').UserProfile | null>
  abstract saveUser(user: import('@/domain/types').UserProfile): Promise<import('@/domain/types').UserProfile>
}
