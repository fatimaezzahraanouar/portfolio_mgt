import * as React from 'react'
import type {
  Alert,
  CorporateEvent,
  IndexCode,
  IndexQuote,
  Instrument,
  Portfolio,
  PortfolioSnapshot,
  PricePoint,
  Quote,
  RangeKey,
  Transaction,
  UserProfile,
  UserSettings,
  WatchlistItem,
} from '@/domain/types'
import {
  buildSnapshot,
  buildValueSeries,
  computePerformance,
  mergeSnapshots,
  type PerformanceResult,
  type ValuePoint,
} from '@/domain/calc'
import { getProvider } from '@/data/provider'
import type { DataProvider } from '@/data/provider'
import { storage } from '@/data/storage'
import { useAuth } from './auth'

const ALL = 'all'

interface StoreState {
  portfolios: Portfolio[]
  instruments: Instrument[]
  quotes: Quote[]
  indices: IndexQuote[]
  events: CorporateEvent[]
  watchlist: WatchlistItem[]
  alerts: Alert[]
  transactions: Transaction[]
  user: UserProfile | null
  priceHistory: Map<string, PricePoint[]>
}

interface StoreValue extends StoreState {
  provider: DataProvider
  loading: boolean
  refreshing: boolean
  error: string | null
  instrumentById: Map<string, Instrument>
  quoteById: Map<string, Quote>
  activeId: string
  setActiveId: (id: string) => void
  activePortfolio: Portfolio | null
  snapshot: PortfolioSnapshot | null
  snapshotOf: (portfolioId: string) => PortfolioSnapshot | null
  performanceOf: (range: RangeKey, portfolioId?: string) => PerformanceResult | null
  seriesOf: (range: RangeKey, portfolioId?: string) => ValuePoint[]
  settings: UserSettings | null
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>
  saveTransaction: (tx: Transaction) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  updatePrice: (instrumentId: string, price: number, date: string) => Promise<void>
  toggleWatch: (instrumentId: string) => Promise<boolean>
  isWatched: (instrumentId: string) => boolean
  saveAlert: (alert: Alert) => Promise<void>
  removeAlert: (id: string) => Promise<void>
  reload: () => void
  resetDemo: () => Promise<void>
}

const StoreContext = React.createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  const provider = React.useMemo(() => getProvider(), [])

  const [state, setState] = React.useState<StoreState | null>(null)
  const [version, setVersion] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeId, setActiveIdState] = React.useState<string>(() =>
    storage.read<string>('activePortfolio', 'pf_cto'),
  )

  const setActiveId = React.useCallback((id: string) => {
    setActiveIdState(id)
    storage.write('activePortfolio', id)
  }, [])

  const reload = React.useCallback(() => setVersion((v) => v + 1), [])

  React.useEffect(() => {
    let alive = true
    if (state) setRefreshing(true)
    else setLoading(true)

    const token = authUser?.id ?? 'anon'
    void (async () => {
      try {
        const [
          portfolios,
          instruments,
          quotes,
          indices,
          events,
          watchlist,
          alerts,
          transactions,
          user,
          priceHistory,
        ] = await Promise.all([
          provider.listPortfolios(token),
          provider.listInstruments(),
          provider.getQuotes(),
          provider.getIndexQuotes(),
          provider.listCorporateEvents(),
          provider.listWatchlist(null),
          provider.listAlerts(null),
          provider.listAllTransactions(),
          provider.getUser(token),
          provider.getPriceHistories(),
        ])
        if (!alive) return
        setState({
          portfolios,
          instruments,
          quotes,
          indices,
          events,
          watchlist,
          alerts,
          transactions,
          user,
          priceHistory,
        })
        setError(null)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement des données')
      } finally {
        if (alive) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, version, authUser?.id])

  /* ------------------------- index dérivés ------------------------- */

  const instrumentById = React.useMemo(
    () => new Map((state?.instruments ?? []).map((i) => [i.id, i])),
    [state?.instruments],
  )
  const quoteById = React.useMemo(
    () => new Map((state?.quotes ?? []).map((q) => [q.instrumentId, q])),
    [state?.quotes],
  )

  const activePortfolio = React.useMemo(() => {
    if (!state) return null
    if (activeId === ALL) return null
    return state.portfolios.find((p) => p.id === activeId) ?? state.portfolios[0] ?? null
  }, [state, activeId])

  const effectiveActiveId = activeId === ALL ? ALL : (activePortfolio?.id ?? ALL)

  const transactionsOf = React.useCallback(
    (portfolioId: string) => {
      const all = state?.transactions ?? []
      if (portfolioId === ALL) return all
      return all.filter((t) => t.portfolioId === portfolioId)
    },
    [state?.transactions],
  )

  const snapshotOf = React.useCallback(
    (portfolioId: string): PortfolioSnapshot | null => {
      if (!state) return null
      const txs = transactionsOf(portfolioId)
      if (portfolioId === ALL) {
        const snaps = state.portfolios.map((p) =>
          buildSnapshot({
            portfolioId: p.id,
            transactions: transactionsOf(p.id),
            instruments: instrumentById,
            quotes: quoteById,
          }),
        )
        return mergeSnapshots(snaps, ALL)
      }
      return buildSnapshot({
        portfolioId,
        transactions: txs,
        instruments: instrumentById,
        quotes: quoteById,
      })
    },
    [state, instrumentById, quoteById, transactionsOf],
  )

  const snapshot = React.useMemo(
    () => (state ? snapshotOf(effectiveActiveId) : null),
    [state, snapshotOf, effectiveActiveId],
  )

  const seriesOf = React.useCallback(
    (range: RangeKey, portfolioId?: string): ValuePoint[] => {
      if (!state) return []
      const pid = portfolioId ?? effectiveActiveId
      const txs = transactionsOf(pid)
      const full = buildValueSeries({
        transactions: txs,
        priceHistory: state.priceHistory,
      })
      if (range === 'MAX') return full
      const end = full.length ? full[full.length - 1].date : ''
      const spanDays: Record<RangeKey, number> = {
        '1J': 5,
        '1S': 7,
        '1M': 31,
        '3M': 92,
        '6M': 183,
        '1A': 366,
        MAX: 100_000,
      }
      const from = new Date(Date.parse(end) - spanDays[range] * 86_400_000)
        .toISOString()
        .slice(0, 10)
      const sliced = full.filter((p) => p.date >= from)
      return sliced.length >= 2 ? sliced : full.slice(-2)
    },
    [state, effectiveActiveId, transactionsOf],
  )

  const performanceOf = React.useCallback(
    (range: RangeKey, portfolioId?: string): PerformanceResult | null => {
      if (!state) return null
      const pid = portfolioId ?? effectiveActiveId
      const txs = transactionsOf(pid)
      const snap = snapshotOf(pid)
      if (!snap) return null
      const points = seriesOf(range, pid)
      const from = points[0]?.date
      const asOf = points[points.length - 1]?.date ?? ''
      return computePerformance({
        transactions: txs,
        priceHistory: state.priceHistory,
        currentValue: snap.totalValue,
        from: range === 'MAX' ? undefined : from,
        to: range === 'MAX' ? undefined : asOf,
        asOf,
      })
    },
    [state, effectiveActiveId, transactionsOf, snapshotOf, seriesOf],
  )

  const settings = state?.user?.settings ?? null

  /* --------------------------- mutations --------------------------- */

  const withReload = React.useCallback(async (fn: () => Promise<unknown>) => {
    await fn()
    setVersion((v) => v + 1)
  }, [])

  const updateSettings = React.useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!state?.user) return
      const next: UserProfile = {
        ...state.user,
        settings: { ...state.user.settings, ...patch, tax: { ...state.user.settings.tax, ...patch.tax } },
      }
      await withReload(() => provider.saveUser(next))
    },
    [state?.user, provider, withReload],
  )

  const saveTransaction = React.useCallback(
    async (tx: Transaction) => {
      await withReload(() => provider.saveTransaction(tx))
    },
    [provider, withReload],
  )

  const removeTransaction = React.useCallback(
    async (id: string) => {
      await withReload(() => provider.deleteTransaction(id))
    },
    [provider, withReload],
  )

  const updatePrice = React.useCallback(
    async (instrumentId: string, price: number, date: string) => {
      await withReload(() => provider.updateQuote(instrumentId, price, date))
    },
    [provider, withReload],
  )

  const toggleWatch = React.useCallback(
    async (instrumentId: string) => {
      const existing = state?.watchlist.find((w) => w.instrumentId === instrumentId)
      if (existing) {
        await withReload(() => provider.deleteWatchlist(existing.id))
        return false
      }
      await withReload(() =>
        provider.saveWatchlist({
          id: '',
          portfolioId: null,
          instrumentId,
          createdAt: new Date().toISOString(),
        }),
      )
      return true
    },
    [state?.watchlist, provider, withReload],
  )

  const isWatched = React.useCallback(
    (instrumentId: string) =>
      (state?.watchlist ?? []).some((w) => w.instrumentId === instrumentId),
    [state?.watchlist],
  )

  const saveAlert = React.useCallback(
    async (alert: Alert) => {
      await withReload(() => provider.saveAlert(alert))
    },
    [provider, withReload],
  )

  const removeAlert = React.useCallback(
    async (id: string) => {
      await withReload(() => provider.deleteAlert(id))
    },
    [provider, withReload],
  )

  const resetDemo = React.useCallback(async () => {
    const p = provider as unknown as { reset?: () => void }
    p.reset?.()
    await withReload(async () => undefined)
  }, [provider, withReload])

  const value = React.useMemo<StoreValue | null>(
    () =>
      state
        ? {
            ...state,
            provider,
            loading,
            refreshing,
            error,
            instrumentById,
            quoteById,
            activeId: effectiveActiveId,
            setActiveId,
            activePortfolio,
            snapshot,
            snapshotOf,
            performanceOf,
            seriesOf,
            settings,
            updateSettings,
            saveTransaction,
            removeTransaction,
            updatePrice,
            toggleWatch,
            isWatched,
            saveAlert,
            removeAlert,
            reload,
            resetDemo,
          }
        : null,
    [
      state,
      provider,
      loading,
      refreshing,
      error,
      instrumentById,
      quoteById,
      effectiveActiveId,
      setActiveId,
      activePortfolio,
      snapshot,
      snapshotOf,
      performanceOf,
      seriesOf,
      settings,
      updateSettings,
      saveTransaction,
      removeTransaction,
      updatePrice,
      toggleWatch,
      isWatched,
      saveAlert,
      removeAlert,
      reload,
      resetDemo,
    ],
  )

  if (!value) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3" aria-busy="true">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="text-sm text-muted">Chargement de votre portefeuille…</p>
        <p className="text-xs text-anthracite-400">Données différées / à titre indicatif</p>
      </div>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé dans <StoreProvider>')
  return ctx
}

/** Sélecteur : snapshot du portefeuille actif (ou agrégé « Tous ») */
export function useSnapshot(): PortfolioSnapshot | null {
  return useStore().snapshot
}

/** Sélecteur : performance sur une plage (1J … MAX) */
export function usePerformance(range: RangeKey = '1A'): PerformanceResult | null {
  const { performanceOf } = useStore()
  return React.useMemo(() => performanceOf(range), [performanceOf, range])
}

export const ALL_PORTFOLIOS = ALL
export type { IndexCode }
