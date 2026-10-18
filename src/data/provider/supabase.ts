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
import { type DataProvider, ProviderNotConfiguredError } from './types'

/**
 * ---------------------------------------------------------------------
 * Fournisseur Supabase (Postgres + Auth + Row Level Security)
 * ---------------------------------------------------------------------
 *
 * Conçu pour être branché SANS dépendance compile-time : on injecte le
 * client `createClient` de @supabase/supabase-js.
 *
 *   import { createClient } from '@supabase/supabase-js'
 *   const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
 *   const provider = new SupabaseDataProvider(client)
 *
 * Le schéma SQL (tables + politiques RLS) est fourni dans
 * `docs/supabase-schema.sql`.
 *
 * Toutes les requêtes sont implicitement filtrées par `user_id` grâce à
 * la RLS : une opération ne peut jamais appartenir à un autre utilisateur.
 */

export interface SupaResult<T> {
  data: T | null
  error: { message: string } | null
}

export interface SupaQuery<T> extends PromiseLike<SupaResult<T>> {
  eq(column: string, value: unknown): SupaQuery<T>
  gte(column: string, value: unknown): SupaQuery<T>
  lte(column: string, value: unknown): SupaQuery<T>
  order(column: string, options?: { ascending?: boolean }): SupaQuery<T>
  limit(count: number): SupaQuery<T>
}

export interface SupabaseLike {
  from(table: string): {
    select(columns: string): SupaQuery<Record<string, unknown>[]>
    insert(row: Record<string, unknown>): SupaQuery<Record<string, unknown>[]>
    update(patch: Record<string, unknown>): SupaQuery<Record<string, unknown>[]>
    delete(): SupaQuery<Record<string, unknown>[]>
  }
}

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[snake(k)] = v
  return out
}

function mapTx(r: Record<string, unknown>): Transaction {
  return {
    id: r.id as string,
    portfolioId: r.portfolio_id as string,
    instrumentId: (r.instrument_id as string) ?? null,
    type: r.type as Transaction['type'],
    date: r.date as string,
    quantity: (r.quantity as number) ?? undefined,
    price: (r.price as number) ?? undefined,
    fees: (r.fees as number) ?? undefined,
    taxes: (r.taxes as number) ?? undefined,
    amount: (r.amount as number) ?? undefined,
    comment: (r.comment as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? undefined,
  }
}

function mapInstrument(r: Record<string, unknown>): Instrument {
  return {
    id: r.id as string,
    type: r.type as Instrument['type'],
    ticker: r.ticker as string,
    name: r.name as string,
    sector: (r.sector as string) ?? undefined,
    currency: 'MAD',
    isin: (r.isin as string) ?? undefined,
    market: (r.market as string) ?? undefined,
    lotSize: (r.lot_size as number) ?? undefined,
    managementCompany: (r.management_company as string) ?? undefined,
    category: (r.category as Instrument['category']) ?? undefined,
    benchmark: (r.benchmark as string) ?? undefined,
    riskLevel: (r.risk_level as number) ?? undefined,
    policy: (r.policy as string) ?? undefined,
    active: r.active !== false,
  }
}

export class SupabaseDataProvider implements DataProvider {
  readonly id = 'supabase'
  readonly label = 'Supabase (Postgres)'
  readonly disclaimer = 'Cours différés — connectez un provider de marché pour la donnée en temps réel'

  private client: SupabaseLike

  constructor(client: SupabaseLike) {
    this.client = client
  }

  private fail(table: string, err: { message: string } | null): never {
    throw new Error(`[${this.id}] ${table} : ${err?.message ?? 'erreur inconnue'}`)
  }

  private async rows(table: string, query: SupaQuery<Record<string, unknown>[]>) {
    const { data, error } = await query
    if (error) this.fail(table, error)
    return data ?? []
  }

  async listInstruments(): Promise<Instrument[]> {
    const rows = await this.rows(
      'instruments',
      this.client.from('instruments').select('*').eq('active', true).order('name'),
    )
    return rows.map(mapInstrument)
  }

  async getInstrument(id: string): Promise<Instrument | null> {
    const rows = await this.rows('instruments', this.client.from('instruments').select('*').eq('id', id).limit(1))
    return rows[0] ? mapInstrument(rows[0]) : null
  }

  /** Historique de cours : table `prices` (PK : instrument_id, date) */
  async getPriceHistory(instrumentId: string): Promise<PricePoint[]> {
    const rows = await this.rows(
      'prices',
      this.client
        .from('prices')
        .select('date, close')
        .eq('instrument_id', instrumentId)
        .order('date', { ascending: true }),
    )
    return rows.map((r) => ({ date: r.date as string, close: Number(r.close) }))
  }

  async getPriceHistories(instrumentIds?: string[]): Promise<Map<string, PricePoint[]>> {
    const ids = instrumentIds ?? (await this.listInstruments()).map((i) => i.id)
    const map = new Map<string, PricePoint[]>()
    for (const id of ids) map.set(id, await this.getPriceHistory(id))
    return map
  }

  /** Vue SQL `v_latest_quotes` : dernier cours / VL par instrument */
  async getQuotes(instrumentIds?: string[]): Promise<Quote[]> {
    let query = this.client.from('v_latest_quotes').select('*')
    if (instrumentIds && instrumentIds.length > 0) query = query.eq('instrument_id', instrumentIds[0])
    const rows = await this.rows('v_latest_quotes', query)
    const filtered = instrumentIds && instrumentIds.length > 1
      ? rows.filter((r) => instrumentIds.includes(r.instrument_id as string))
      : rows
    return filtered.map((r) => ({
      instrumentId: r.instrument_id as string,
      date: r.date as string,
      close: Number(r.close),
      changePct: Number(r.change_pct ?? 0),
      volume: (r.volume as number) ?? undefined,
      marketCap: (r.market_cap as number) ?? undefined,
      per: (r.per as number) ?? undefined,
      dividendPerShare: (r.dividend_per_share as number) ?? undefined,
      dividendYield: (r.dividend_yield as number) ?? undefined,
    }))
  }

  async getIndexQuotes(): Promise<IndexQuote[]> {
    const rows = await this.rows('indices', this.client.from('indices').select('*').order('code'))
    return rows.map((r) => ({
      code: r.code as IndexCode,
      name: r.name as string,
      value: Number(r.value),
      changePct: Number(r.change_pct ?? 0),
    }))
  }

  async getIndexHistory(code: IndexCode): Promise<PricePoint[]> {
    const rows = await this.rows(
      'index_prices',
      this.client.from('index_prices').select('date, close').eq('code', code).order('date', { ascending: true }),
    )
    return rows.map((r) => ({ date: r.date as string, close: Number(r.close) }))
  }

  /** Mise à jour manuelle → table `prices` (l'utilisateur reste propriétaire de la ligne) */
  async updateQuote(instrumentId: string, price: number, date: string): Promise<Quote | null> {
    const { error } = await this.client
      .from('prices')
      .insert({ instrument_id: instrumentId, date, close: price, source: 'manual' })
    if (error) this.fail('prices', error)
    const quotes = await this.getQuotes([instrumentId])
    return quotes[0] ?? null
  }

  listManualOverrides(): Array<{ instrumentId: string; price: number; date: string }> {
    return []
  }

  async listPortfolios(): Promise<Portfolio[]> {
    const rows = await this.rows('portfolios', this.client.from('portfolios').select('*').order('created_at'))
    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      name: r.name as string,
      kind: (r.kind as string) ?? 'CTO',
      color: (r.color as string) ?? '#d13c18',
      createdAt: r.created_at as string,
      note: (r.note as string) ?? undefined,
    }))
  }

  async listTransactions(portfolioId: string): Promise<Transaction[]> {
    const rows = await this.rows(
      'transactions',
      this.client
        .from('transactions')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('date', { ascending: true }),
    )
    return rows.map(mapTx)
  }

  async listAllTransactions(): Promise<Transaction[]> {
    const rows = await this.rows(
      'transactions',
      this.client.from('transactions').select('*').order('date', { ascending: true }),
    )
    return rows.map(mapTx)
  }

  async saveTransaction(tx: Transaction): Promise<Transaction> {
    const payload = toRow({ ...tx, id: undefined })
    const { data, error } = await this.client.from('transactions').insert(payload)
    if (error) this.fail('transactions', error)
    return { ...tx, id: (data?.[0]?.id as string) ?? tx.id }
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.client.from('transactions').delete().eq('id', id)
    if (error) this.fail('transactions', error)
  }

  async listCorporateEvents(from?: string, to?: string): Promise<CorporateEvent[]> {
    let query = this.client.from('corporate_events').select('*').order('date')
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)
    const rows = await this.rows('corporate_events', query)
    return rows.map((r) => ({
      id: r.id as string,
      instrumentId: r.instrument_id as string,
      type: r.type as CorporateEvent['type'],
      date: r.date as string,
      label: r.label as string,
      amount: (r.amount as number) ?? undefined,
    }))
  }

  async listWatchlist(): Promise<WatchlistItem[]> {
    const rows = await this.rows('watchlists', this.client.from('watchlists').select('*'))
    return rows.map((r) => ({
      id: r.id as string,
      portfolioId: (r.portfolio_id as string) ?? null,
      instrumentId: r.instrument_id as string,
      createdAt: r.created_at as string,
    }))
  }

  async saveWatchlist(item: WatchlistItem): Promise<WatchlistItem> {
    const { error } = await this.client.from('watchlists').insert(toRow({ ...item }))
    if (error) this.fail('watchlists', error)
    return item
  }

  async deleteWatchlist(id: string): Promise<void> {
    const { error } = await this.client.from('watchlists').delete().eq('id', id)
    if (error) this.fail('watchlists', error)
  }

  async listAlerts(): Promise<Alert[]> {
    const rows = await this.rows('alerts', this.client.from('alerts').select('*').order('created_at'))
    return rows.map((r) => ({
      id: r.id as string,
      portfolioId: (r.portfolio_id as string) ?? null,
      instrumentId: r.instrument_id as string,
      type: r.type as Alert['type'],
      threshold: Number(r.threshold ?? 0),
      active: r.active !== false,
      channels: (r.channels as Alert['channels']) ?? ['IN_APP'],
      createdAt: r.created_at as string,
      triggeredAt: (r.triggered_at as string) ?? undefined,
    }))
  }

  async saveAlert(alert: Alert): Promise<Alert> {
    const { error } = await this.client.from('alerts').insert(toRow({ ...alert }))
    if (error) this.fail('alerts', error)
    return alert
  }

  async deleteAlert(id: string): Promise<void> {
    const { error } = await this.client.from('alerts').delete().eq('id', id)
    if (error) this.fail('alerts', error)
  }

  async getUser(userId: string): Promise<UserProfile | null> {
    const rows = await this.rows('profiles', this.client.from('profiles').select('*').eq('id', userId).limit(1))
    const r = rows[0]
    if (!r) return null
    return {
      id: r.id as string,
      email: r.email as string,
      fullName: r.full_name as string,
      phone: (r.phone as string) ?? undefined,
      createdAt: r.created_at as string,
      settings: (r.settings as UserProfile['settings']) ?? ({} as UserProfile['settings']),
    }
  }

  async saveUser(user: UserProfile): Promise<UserProfile> {
    const { error } = await this.client.from('profiles').update(toRow({ ...user })).eq('id', user.id)
    if (error) this.fail('profiles', error)
    return user
  }
}

export function requireConfigured(provider: DataProvider): void {
  if (provider.id === 'supabase' && !('from' in provider)) {
    throw new ProviderNotConfiguredError('supabase', 'Injectez le client Supabase via new SupabaseDataProvider(client).')
  }
}
