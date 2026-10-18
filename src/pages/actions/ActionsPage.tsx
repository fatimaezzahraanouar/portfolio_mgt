import * as React from 'react'
import { Link } from 'react-router-dom'
import { Download, PieChart, Plus, Search, Star, TrendingUp } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import type { Position } from '@/domain/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR, SortHeader } from '@/components/ui/table'
import { EmptyState, PageHeader, SkeletonRows } from '@/components/shared/page'
import { Delta, StatCard } from '@/components/shared/stat-card'
import { PortfolioTabs } from '@/components/shared/portfolio-tabs'
import { Money } from '@/components/shared/money'
import { WatchButton } from '@/components/shared/watch-button'
import { downloadCsv } from '@/lib/export'
import { formatDate, formatNumber, formatPct, signClass } from '@/lib/format'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'quantity' | 'pru' | 'lastPrice' | 'marketValue' | 'unrealizedPnl' | 'weight' | 'dayChangePct'

function useActionsRows() {
  const { snapshot, quoteById } = useStore()
  return React.useMemo(() => {
    if (!snapshot) return []
    return snapshot.positions
      .filter((p) => p.type === 'ACTION')
      .map((p) => ({ ...p, quote: quoteById.get(p.instrumentId) }))
  }, [snapshot, quoteById])
}

function PositionCard({ p }: { p: Position }) {
  const { locale } = useI18n()
  const { quoteById } = useStore()
  const quote = quoteById.get(p.instrumentId)
  return (
    <Link
      to={`/actions/${p.instrumentId}`}
      className="block rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-brand-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
          <p className="text-[11px] text-muted">
            {p.ticker} · {p.sector}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {formatPct(p.weight, { locale, decimals: 1, sign: false })}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">Quantité</p>
          <p className="text-sm font-bold tabular">{formatNumber(p.quantity, { locale, decimals: 0 })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">PRU</p>
          <p className="text-sm font-bold tabular">{formatNumber(p.pru, { locale, decimals: 2 })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">Cours</p>
          <p className="text-sm font-bold tabular">{formatNumber(p.lastPrice, { locale, decimals: 2 })}</p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-border pt-2.5">
        <div>
          <p className="text-[10px] uppercase text-anthracite-500">Valorisation</p>
          <Money value={p.marketValue} className="text-base font-bold text-ink" />
        </div>
        <div className="text-end">
          <p className="text-[10px] uppercase text-anthracite-500">+/- value</p>
          <p className={cn('text-sm font-bold tabular', signClass(p.unrealizedPnl))}>
            <Money value={p.unrealizedPnl} reveal hideMaskable />
          </p>
          <Delta value={p.unrealizedPnlPct} iconSize="xs" className="text-[11px]" />
        </div>
      </div>
      {quote ? (
        <p className="mt-2 text-[11px] text-muted">
          Dernier cours : {formatDate(quote.date, locale)} · variation{' '}
          <Delta value={quote.changePct} iconSize="xs" />
        </p>
      ) : null}
    </Link>
  )
}

export default function ActionsPage() {
  const t = useT()
  const { locale } = useI18n()
  const { snapshot, loading, instrumentById, isWatched, activeId } = useStore()
  const rows = useActionsRows()

  const [search, setSearch] = React.useState('')
  const [sector, setSector] = React.useState('all')
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'marketValue',
    dir: 'desc',
  })

  const sectors = React.useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter(Boolean))] as string[],
    [rows],
  )

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter((r) => {
      const inst = instrumentById.get(r.instrumentId)
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.ticker.toLowerCase().includes(q) ||
        (inst?.isin ?? '').toLowerCase().includes(q)
      const matchS = sector === 'all' || r.sector === sector
      return matchQ && matchS
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const k = sort.key
      if (k === 'name') return a.name.localeCompare(b.name) * dir
      return (((a[k] as number) ?? 0) - ((b[k] as number) ?? 0)) * dir
    })
  }, [rows, search, sector, sort, instrumentById])

  const totals = React.useMemo(() => {
    if (!snapshot) return { value: 0, pnl: 0, cost: 0, day: 0, pct: 0 }
    const value = rows.reduce((s, r) => s + r.marketValue, 0)
    const pnl = rows.reduce((s, r) => s + r.unrealizedPnl, 0)
    const cost = rows.reduce((s, r) => s + r.cost, 0)
    const day = rows.reduce((s, r) => s + (r.marketValue - r.marketValue / (1 + r.dayChangePct / 100)), 0)
    const pct = snapshot.totalValue > 0 ? (value / snapshot.totalValue) * 100 : 0
    return { value, pnl, cost, day, pct }
  }, [rows, snapshot])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  function exportCsv() {
    downloadCsv(
      `mes-actions-${activeId}`,
      ['Valeur', 'Ticker', 'ISIN', 'Secteur', 'Quantité', 'PRU (MAD)', 'Cours (MAD)', 'Valorisation (MAD)', '+/- value (MAD)', '+/- value (%)', 'Poids (%)'],
      filtered.map((r) => {
        const inst = instrumentById.get(r.instrumentId)
        return [
          r.name,
          r.ticker,
          inst?.isin ?? '',
          r.sector ?? '',
          r.quantity,
          r.pru.toFixed(4),
          r.lastPrice.toFixed(4),
          r.marketValue.toFixed(2),
          r.unrealizedPnl.toFixed(2),
          r.unrealizedPnlPct.toFixed(2),
          r.weight.toFixed(2),
        ]
      }),
    )
  }

  return (
    <>
      <PageHeader
        title={t('actions.title')}
        description={`${rows.length} ligne(s) · ${t('app.disclaimer')}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download /> {t('common.export')} CSV
            </Button>
            <Button asChild size="sm">
              <Link to="/operations">
                <Plus /> {t('ops.add')}
              </Link>
            </Button>
          </>
        }
      />

      <PortfolioTabs current="actions" />

      {loading ? (
        <Card>
          <CardContent>
            <SkeletonRows rows={7} />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune action dans ce portefeuille"
          description="Saisissez vos achats d’actions (IAM, Attijariwafa Bank, BCP, LafargeHolcim…) dans le journal des opérations pour suivre votre exposition au marché de Casablanca."
          action={
            <Button asChild>
              <Link to="/operations">
                <Plus /> {t('ops.add')}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Valeur des actions" value={totals.value} hint={`${formatPct(totals.pct, { locale, decimals: 1, sign: false })} du portefeuille`} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard
              label={t('dash.unrealized')}
              value={totals.pnl}
              delta={totals.cost > 0 ? (totals.pnl / totals.cost) * 100 : 0}
              deltaLabel="sur coût"
            />
            <StatCard label="Variation du jour" value={totals.day} delta={snapshot ? snapshot.dayChangePct : 0} />
            <StatCard label={t('dash.liquidity')} value={snapshot?.cash.balance ?? 0} icon={<PieChart className="h-4 w-4" />} />
          </div>

          <Card className="mb-4 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-anthracite-400" />
                <Input
                  className="ps-9"
                  placeholder={t('common.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('common.search')}
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="sector-filter" className="sr-only">
                  {t('common.sector')}
                </label>
                <Select
                  id="sector-filter"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="sm:w-56"
                >
                  <option value="all">Tous les secteurs</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          {/* Desktop */}
          <Card className="hidden p-0 md:block">
            <Table>
              <THead>
                <TR>
                  <SortHeader label={t('common.name')} active={sort.key === 'name'} dir={sort.dir} onClick={() => toggleSort('name')} />
                  <SortHeader label="Qté" align="end" active={sort.key === 'quantity'} dir={sort.dir} onClick={() => toggleSort('quantity')} />
                  <SortHeader label={t('actions.pru')} align="end" active={sort.key === 'pru'} dir={sort.dir} onClick={() => toggleSort('pru')} />
                  <SortHeader label={t('actions.last')} align="end" active={sort.key === 'lastPrice'} dir={sort.dir} onClick={() => toggleSort('lastPrice')} />
                  <SortHeader label="Var. J" align="end" active={sort.key === 'dayChangePct'} dir={sort.dir} onClick={() => toggleSort('dayChangePct')} />
                  <SortHeader label="Valorisation" align="end" active={sort.key === 'marketValue'} dir={sort.dir} onClick={() => toggleSort('marketValue')} />
                  <SortHeader label={t('actions.unrealized')} align="end" active={sort.key === 'unrealizedPnl'} dir={sort.dir} onClick={() => toggleSort('unrealizedPnl')} />
                  <SortHeader label={t('common.share')} align="end" active={sort.key === 'weight'} dir={sort.dir} onClick={() => toggleSort('weight')} />
                  <TH align="end" />
                </TR>
              </THead>
              <TBody>
                {filtered.map((r) => (
                  <TR key={r.instrumentId}>
                    <TD>
                      <Link to={`/actions/${r.instrumentId}`} className="block min-w-44">
                        <span className="block truncate font-semibold text-ink hover:text-brand-700">{r.name}</span>
                        <span className="block text-[11px] text-muted">
                          {r.ticker} · {r.sector}
                        </span>
                      </Link>
                    </TD>
                    <TD align="end">{formatNumber(r.quantity, { locale, decimals: 0 })}</TD>
                    <TD align="end">{formatNumber(r.pru, { locale, decimals: 2 })}</TD>
                    <TD align="end">
                      <span className="font-semibold">{formatNumber(r.lastPrice, { locale, decimals: 2 })}</span>
                      <span className="block text-[10px] text-muted">{formatDate(r.priceDate, locale)}</span>
                    </TD>
                    <TD align="end">
                      <Delta value={r.dayChangePct} iconSize="xs" />
                    </TD>
                    <TD align="end">
                      <Money value={r.marketValue} className="font-semibold" />
                    </TD>
                    <TD align="end">
                      <span className={cn('block font-semibold', signClass(r.unrealizedPnl))}>
                        <Money value={r.unrealizedPnl} reveal hideMaskable />
                      </span>
                      <Delta value={r.unrealizedPnlPct} iconSize="xs" className="text-[11px]" />
                    </TD>
                    <TD align="end">
                      <div className="ms-auto w-20">
                        <span className="text-xs font-semibold">{formatPct(r.weight, { locale, decimals: 1, sign: false })}</span>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-anthracite-200 dark:bg-anthracite-800">
                          <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.min(100, r.weight)}%` }} />
                        </div>
                      </div>
                    </TD>
                    <TD align="end">
                      <WatchButton instrumentId={r.instrumentId} watched={isWatched(r.instrumentId)} iconOnly />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="grid gap-2.5 md:hidden">
            {filtered.map((r) => (
              <PositionCard key={r.instrumentId} p={r} />
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Aucun résultat" description="Modifiez la recherche ou le filtre de secteur." className="mt-4" />
          ) : null}
        </>
      )}
    </>
  )
}
