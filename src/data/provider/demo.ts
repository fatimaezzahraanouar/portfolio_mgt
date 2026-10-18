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
import { SEED_ALERTS, SEED_EVENTS, SEED_WATCHLIST } from '@/data/demo/engagement'
import { DATA_AS_OF, addDays } from '@/data/demo/constants'
import {
  allIndexQuotes,
  buildPriceHistoryMap,
  indexHistory,
  latestNav,
  navHistoryOf,
  priceHistoryOf,
  quoteOf,
  quoteOfFund,
} from '@/data/demo/market'
import { ALL_INSTRUMENTS } from '@/data/demo/instruments'
import {
  SEED_PORTFOLIOS,
  SEED_TRANSACTIONS,
  SEED_USER,
} from '@/data/demo/transactions'
import { storage } from '@/data/storage'
import { type DataProvider, uid } from './types'

interface DemoState {
  transactions: Transaction[]
  alerts: Alert[]
  watchlist: WatchlistItem[]
  overrides: Array<{ instrumentId: string; price: number; date: string }>
  user: UserProfile
}

const STORAGE_KEY = 'state'

function defaultState(): DemoState {
  return {
    transactions: SEED_TRANSACTIONS,
    alerts: SEED_ALERTS,
    watchlist: SEED_WATCHLIST,
    overrides: [],
    user: {
      id: SEED_USER.id,
      email: SEED_USER.email,
      fullName: SEED_USER.fullName,
      phone: SEED_USER.phone,
      createdAt: SEED_USER.createdAt,
      settings: {
        displayCurrency: 'MAD',
        defaultFeePct: 0.5,
        defaultFeeMin: 50,
        tax: {
          capitalGainsRate: 10,
          dividendWithholdingRate: 15,
          exemptionThreshold: 0,
          fiscalYear: 2026,
        },
        locale: 'fr',
        theme: 'light',
        maskAmounts: false,
        twoFactor: 'EMAIL',
      },
    },
  }
}

/** Latence simulée pour matérialiser les squelettes de chargement */
function withLatency<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export class DemoDataProvider implements DataProvider {
  readonly id = 'demo'
  readonly label = 'Données de démonstration'
  readonly disclaimer = 'Données différées / à titre indicatif — jeu de démonstration'

  private state: DemoState
  private events: CorporateEvent[] = [...SEED_EVENTS]
  private portfolios: Portfolio[] = [...SEED_PORTFOLIOS]

  constructor() {
    const saved = storage.read<DemoState | null>(STORAGE_KEY, null)
    this.state = saved && Array.isArray(saved.transactions) ? saved : defaultState()
  }

  private persist() {
    storage.write(STORAGE_KEY, this.state)
  }

  /** Réinitialise intégralement le jeu de démonstration */
  reset() {
    storage.remove(STORAGE_KEY)
    this.state = defaultState()
    this.events = [...SEED_EVENTS]
    this.portfolios = [...SEED_PORTFOLIOS]
  }

  /* ---------------------------------------------------------------- */
  /* Référentiel                                                        */
  /* ---------------------------------------------------------------- */

  async listInstruments(): Promise<Instrument[]> {
    return withLatency(ALL_INSTRUMENTS, 180)
  }

  async getInstrument(id: string): Promise<Instrument | null> {
    return ALL_INSTRUMENTS.find((i) => i.id === id) ?? null
  }

  /* ---------------------------------------------------------------- */
  /* Cours & VL                                                         */
  /* ---------------------------------------------------------------- */

  private overrideOf(id: string) {
    return this.state.overrides.find((o) => o.instrumentId === id)
  }

  private applyOverride(id: string, series: PricePoint[]): PricePoint[] {
    const o = this.overrideOf(id)
    if (!o || series.length === 0) return series
    const copy = series.slice(0, -1)
    copy.push({ date: o.date, close: o.price })
    return copy
  }

  async getPriceHistory(instrumentId: string): Promise<PricePoint[]> {
    const base = instrumentId.startsWith('OPC_')
      ? navHistoryOf(instrumentId)
      : priceHistoryOf(instrumentId)
    return this.applyOverride(instrumentId, base)
  }

  async getPriceHistories(instrumentIds?: string[]): Promise<Map<string, PricePoint[]>> {
    const all = buildPriceHistoryMap()
    const map = new Map<string, PricePoint[]>()
    const ids = instrumentIds ?? [...all.keys()]
    for (const id of ids) {
      const series = all.get(id) ?? (await this.getPriceHistory(id))
      map.set(id, this.applyOverride(id, series))
    }
    return map
  }

  private buildQuote(id: string): Quote | null {
    const base = id.startsWith('OPC_') ? quoteOfFund(id) : quoteOf(id)
    if (!base) return null
    const o = this.overrideOf(id)
    if (!o) return base
    const history = id.startsWith('OPC_') ? navHistoryOf(id) : priceHistoryOf(id)
    // après remplacement du dernier point, l'avant-dernier reste le cours de la veille
    const prev = history.length > 1 ? history[history.length - 2].close : o.price
    const changePct = prev > 0 ? Math.round((o.price / prev - 1) * 10_000_000) / 100_000 : 0
    return {
      ...base,
      close: o.price,
      date: o.date,
      changePct,
      marketCap: base.marketCap ? Math.round((base.marketCap / base.close) * o.price) : undefined,
      per: base.per ? Math.round((base.per / base.close) * o.price * 100) / 100 : undefined,
      dividendYield:
        base.dividendPerShare && o.price > 0
          ? Math.round((base.dividendPerShare / o.price) * 10000) / 100
          : base.dividendYield,
    }
  }

  async getQuotes(instrumentIds?: string[]): Promise<Quote[]> {
    const ids = instrumentIds ?? ALL_INSTRUMENTS.map((i) => i.id)
    return withLatency(
      ids.map((id) => this.buildQuote(id)).filter((q): q is Quote => q !== null),
    )
  }

  async getIndexQuotes(): Promise<IndexQuote[]> {
    return withLatency(allIndexQuotes(), 120)
  }

  async getIndexHistory(code: IndexCode): Promise<PricePoint[]> {
    return indexHistory(code)
  }

  async updateQuote(instrumentId: string, price: number, date: string): Promise<Quote | null> {
    const existing = this.state.overrides.findIndex((o) => o.instrumentId === instrumentId)
    const entry = { instrumentId, price, date }
    if (existing >= 0) this.state.overrides[existing] = entry
    else this.state.overrides.push(entry)
    this.persist()
    return this.buildQuote(instrumentId)
  }

  listManualOverrides() {
    return [...this.state.overrides]
  }

  /* ---------------------------------------------------------------- */
  /* Portefeuilles & opérations                                         */
  /* ---------------------------------------------------------------- */

  async listPortfolios(): Promise<Portfolio[]> {
    return withLatency(this.portfolios, 150)
  }

  async listTransactions(portfolioId: string): Promise<Transaction[]> {
    return withLatency(
      this.state.transactions.filter((t) => t.portfolioId === portfolioId),
      120,
    )
  }

  async listAllTransactions(): Promise<Transaction[]> {
    return withLatency([...this.state.transactions], 120)
  }

  async saveTransaction(tx: Transaction): Promise<Transaction> {
    const idx = this.state.transactions.findIndex((t) => t.id === tx.id)
    const saved: Transaction = {
      ...tx,
      id: tx.id || uid('tx'),
      createdAt: tx.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (idx >= 0) this.state.transactions[idx] = saved
    else this.state.transactions.push(saved)
    this.persist()
    return saved
  }

  async deleteTransaction(id: string): Promise<void> {
    this.state.transactions = this.state.transactions.filter((t) => t.id !== id)
    this.persist()
  }

  /* ---------------------------------------------------------------- */
  /* Alertes & watchlist                                                */
  /* ---------------------------------------------------------------- */

  async listCorporateEvents(from = DATA_AS_OF, to = addDays(DATA_AS_OF, 400)): Promise<CorporateEvent[]> {
    return this.events
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async listWatchlist(): Promise<WatchlistItem[]> {
    return [...this.state.watchlist]
  }

  async saveWatchlist(item: WatchlistItem): Promise<WatchlistItem> {
    const saved = { ...item, id: item.id || uid('wl') }
    const i = this.state.watchlist.findIndex((w) => w.id === saved.id)
    if (i >= 0) this.state.watchlist[i] = saved
    else this.state.watchlist.push(saved)
    this.persist()
    return saved
  }

  async deleteWatchlist(id: string): Promise<void> {
    this.state.watchlist = this.state.watchlist.filter((w) => w.id !== id)
    this.persist()
  }

  async listAlerts(): Promise<Alert[]> {
    return [...this.state.alerts]
  }

  async saveAlert(alert: Alert): Promise<Alert> {
    const saved = { ...alert, id: alert.id || uid('al') }
    const i = this.state.alerts.findIndex((a) => a.id === saved.id)
    if (i >= 0) this.state.alerts[i] = saved
    else this.state.alerts.push(saved)
    this.persist()
    return saved
  }

  async deleteAlert(id: string): Promise<void> {
    this.state.alerts = this.state.alerts.filter((a) => a.id !== id)
    this.persist()
  }

  /* ---------------------------------------------------------------- */
  /* Profil                                                             */
  /* ---------------------------------------------------------------- */

  async getUser(): Promise<UserProfile | null> {
    return this.state.user
  }

  async saveUser(user: UserProfile): Promise<UserProfile> {
    this.state.user = user
    this.persist()
    return user
  }
}

/** Dernière VL connue d'un fonds (utilisé par l'écran OPCVM) */
export { latestNav }
