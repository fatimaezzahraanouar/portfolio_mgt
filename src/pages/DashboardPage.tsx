import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Banknote,
  CalendarClock,
  Coins,
  Flame,
  Landmark,
  Layers,
  Snowflake,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import { usePreferences } from '@/state/preferences'
import { buildAllocation, buildSectorAllocation, rebase, drawdownSeries } from '@/domain/calc'
import type { RangeKey } from '@/domain/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader, SkeletonCards, EmptyState } from '@/components/shared/page'
import { CardWithHeader, StatCard, Delta } from '@/components/shared/stat-card'
import { Money } from '@/components/shared/money'
import { DonutChart, HBarList, PortfolioChart, RangeTabs } from '@/components/shared/charts'
import { formatDate, formatNumber, formatPct, signClass } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Bandeau indices (mobile)                                             */
/* ------------------------------------------------------------------ */

function IndicesStrip() {
  const { indices } = useStore()
  const { locale } = useI18n()
  if (indices.length === 0) return null
  return (
    <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 xl:hidden">
      {indices.map((idx) => (
        <div
          key={idx.code}
          className="flex shrink-0 items-baseline gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
        >
          <span className="text-[10px] font-bold uppercase text-anthracite-500">{idx.name}</span>
          <span className="tabular text-xs font-semibold">
            {formatNumber(idx.value, { locale, decimals: 2 })}
          </span>
          <span className={cn('tabular text-[11px] font-semibold', signClass(idx.changePct))}>
            {idx.changePct >= 0 ? '▲' : '▼'} {formatPct(idx.changePct, { locale })}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carte principale                                                     */
/* ------------------------------------------------------------------ */

function HeroCard() {
  const t = useT()
  const { locale } = useI18n()
  const { snapshot, activePortfolio, portfolios, activeId } = useStore()
  const { maskAmounts } = usePreferences()
  if (!snapshot) return <SkeletonCards count={1} />

  const title =
    activeId === 'all'
      ? `${t('dash.totalValue')} — ${t('common.all')} (${portfolios.length})`
      : `${t('dash.totalValue')} — ${activePortfolio?.name ?? ''}`

  return (
    <Card className="relative overflow-hidden border-brand-200 bg-gradient-to-br from-card via-card to-brand-50/70 dark:border-brand-900 dark:to-brand-950/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-brand-500/10 blur-2xl"
      />
      <CardContent className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            <Money
              value={snapshot.totalValue}
              className="text-3xl font-bold leading-none text-ink sm:text-4xl"
            />
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                snapshot.dayChangePct >= 0
                  ? 'bg-gain-500/10 text-gain-600'
                  : 'bg-loss-500/10 text-loss-600',
              )}
            >
              {snapshot.dayChangePct >= 0 ? '▲' : '▼'}
              <Money
                value={snapshot.dayChangeAbs}
                decimals={0}
                className="font-bold"
                reveal
                hideMaskable
              />
              <span className="opacity-60">·</span>
              {formatPct(snapshot.dayChangePct, { locale })}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t('dash.dayChange')} ·{' '}
            <span className="font-medium text-anthracite-600 dark:text-anthracite-300">
              {maskAmounts ? '•••••' : `${formatPct(snapshot.dayChangePct, { locale })} sur la dernière séance`}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-1">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-anthracite-500">
              {t('dash.unrealized')}
            </p>
            <p className={cn('text-lg font-bold tabular', signClass(snapshot.unrealizedPnl))}>
              <Money value={snapshot.unrealizedPnl} reveal hideMaskable />
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-anthracite-500">
              {t('dash.realized')}
            </p>
            <p className={cn('text-lg font-bold tabular', signClass(snapshot.realizedPnl))}>
              <Money value={snapshot.realizedPnl} reveal hideMaskable />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Top gagnants / perdants                                              */
/* ------------------------------------------------------------------ */

function TopMovers({ direction }: { direction: 'up' | 'down' }) {
  const t = useT()
  const { locale } = useI18n()
  const { quotes, instrumentById } = useStore()

  const sorted = [...quotes].sort((a, b) =>
    direction === 'up' ? b.changePct - a.changePct : a.changePct - b.changePct,
  )
  const rows = sorted.slice(0, 5)

  return (
    <CardWithHeader
      title={
        <span className="flex items-center gap-2">
          {direction === 'up' ? (
            <Flame className="h-4 w-4 text-brand-600" />
          ) : (
            <Snowflake className="h-4 w-4 text-anthracite-500" />
          )}
          {direction === 'up' ? t('dash.topGainers') : t('dash.topLosers')}
        </span>
      }
      action={<Badge variant="outline">{t('common.day')}</Badge>}
    >
      {rows.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((q) => {
            const inst = instrumentById.get(q.instrumentId)
            const isFund = inst?.type === 'OPCVM'
            return (
              <li key={q.instrumentId}>
                <Link
                  to={isFund ? `/opcvm/${q.instrumentId}` : `/actions/${q.instrumentId}`}
                  className="flex items-center gap-3 py-2 transition-colors hover:bg-anthracite-50/70 dark:hover:bg-anthracite-800/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-anthracite-100 text-[11px] font-bold text-anthracite-600 dark:bg-anthracite-800 dark:text-anthracite-300">
                    {inst?.ticker.slice(0, 3) ?? '—'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {inst?.name ?? q.instrumentId}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {isFund ? 'OPCVM · ' + (inst?.managementCompany ?? '') : inst?.sector}
                    </span>
                  </span>
                  <span className="text-end">
                    <span className="block text-sm font-semibold tabular">
                      {formatNumber(q.close, { locale, decimals: 2 })}
                    </span>
                    <Delta value={q.changePct} iconSize="xs" className="text-xs" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </CardWithHeader>
  )
}

/* ------------------------------------------------------------------ */
/* Prochains événements                                                 */
/* ------------------------------------------------------------------ */

function UpcomingEvents() {
  const t = useT()
  const { locale } = useI18n()
  const { events, instrumentById } = useStore()
  const upcoming = events.slice(0, 7)

  const icon = (type: string) =>
    type === 'DIVIDEND_DETACH' ? (
      <Coins className="h-3.5 w-3.5 text-brand-600" />
    ) : type === 'AG' ? (
      <Landmark className="h-3.5 w-3.5 text-anthracite-500" />
    ) : (
      <CalendarClock className="h-3.5 w-3.5 text-anthracite-500" />
    )

  return (
    <CardWithHeader
      title={t('dash.events')}
      action={
        <Button asChild variant="link" size="sm">
          <Link to="/alertes">
            {t('common.more')} <ArrowUpRight />
          </Link>
        </Button>
      }
    >
      {upcoming.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <ul className="space-y-2.5">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-anthracite-100 dark:bg-anthracite-800">
                {icon(e.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{e.label}</p>
                <p className="text-[11px] text-muted">
                  {instrumentById.get(e.instrumentId)?.name ?? e.instrumentId}
                  {e.amount ? ` · ${formatNumber(e.amount, { locale, decimals: 2 })} MAD / titre` : ''}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-anthracite-100 px-2 py-1 text-[11px] font-semibold text-anthracite-700 dark:bg-anthracite-800 dark:text-anthracite-300">
                {formatDate(e.date, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardWithHeader>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const t = useT()
  const { locale } = useI18n()
  const {
    snapshot,
    loading,
    seriesOf,
    performanceOf,
    quoteById,
    instrumentById,
    priceHistory,
    provider,
    activeId,
  } = useStore()

  const [range, setRange] = React.useState<RangeKey>('1A')
  const [showBench, setShowBench] = React.useState(true)
  const [masi, setMasi] = React.useState<Array<{ date: string; close: number }>>([])

  React.useEffect(() => {
    let alive = true
    void provider.getIndexHistory('MASI').then((h) => {
      if (alive) setMasi(h)
    })
    return () => {
      alive = false
    }
  }, [provider, activeId])

  const series = React.useMemo(() => seriesOf(range), [seriesOf, range])
  const perf = React.useMemo(() => performanceOf(range), [performanceOf, range])

  const chartData = React.useMemo(
    () => series.map((p) => ({ date: p.date, value: p.value, pct: p.twrPct })),
    [series],
  )

  const benchmark = React.useMemo(
    () => (masi.length && series.length ? rebase(masi, series.map((p) => p.date)) : []),
    [masi, series],
  )

  const allocation = React.useMemo(
    () => (snapshot ? buildAllocation(snapshot.positions, snapshot.cash.balance) : []),
    [snapshot],
  )
  const sectors = React.useMemo(
    () => (snapshot ? buildSectorAllocation(snapshot.positions, snapshot.totalValue) : []),
    [snapshot],
  )

  const drawdown = React.useMemo(() => drawdownSeries(series), [series])

  if (loading || !snapshot) {
    return (
      <>
        <PageHeader title={t('dash.title')} />
        <SkeletonCards count={4} />
        <div className="mt-4">
          <SkeletonCards count={2} />
        </div>
      </>
    )
  }

  const topWeight = snapshot.positions[0]
  const cashWeight =
    snapshot.totalValue > 0 ? (snapshot.cash.balance / snapshot.totalValue) * 100 : 0

  return (
    <>
      <PageHeader
        title={t('dash.title')}
        description={`${t('app.disclaimer')} · dernière séance : ${formatDate(
          series.at(-1)?.date ?? '',
          locale,
        )}`}
        actions={<RangeTabs value={range} onChange={setRange} />}
      />

      <IndicesStrip />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-2">
          <HeroCard />
        </div>
        <StatCard
          label={t('dash.liquidity')}
          value={snapshot.cash.balance}
          delta={cashWeight}
          deltaLabel={formatPct(cashWeight, { locale, decimals: 1, sign: false }) + ' du total'}
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard
          label={t('dash.invested')}
          value={snapshot.invested}
          hint={
            <>
              {t('dash.realized')} :{' '}
              <Money value={snapshot.realizedPnl} reveal hideMaskable />
            </>
          }
          icon={<Layers className="h-4 w-4" />}
        />
      </div>

      {/* Évolution */}
      <Card className="mt-3">
        <CardHeader>
          <div>
            <CardTitle className="text-sm">{t('dash.evolution')}</CardTitle>
            <p className="mt-0.5 text-xs text-muted">
              {t('dash.vsMasi')} — courbe en pointillés · TWR cumulé{' '}
              <span className={cn('font-semibold', signClass(perf?.twr ?? 0))}>
                {formatPct((perf?.twr ?? 0) * 100, { locale })}
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowBench((v) => !v)}>
            {showBench ? 'Masquer le MASI' : 'Afficher le MASI'}
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState title={t('common.empty')} />
          ) : (
            <PortfolioChart
              data={chartData}
              benchmark={benchmark}
              showBenchmark={showBench}
              height={280}
            />
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase text-anthracite-500">{t('perf.twr')}</p>
              <p className={cn('text-sm font-bold tabular', signClass((perf?.twr ?? 0) * 100))}>
                {formatPct((perf?.twr ?? 0) * 100, { locale })}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-anthracite-500">{t('perf.xirr')}</p>
              <p className={cn('text-sm font-bold tabular', signClass((perf?.xirr ?? 0) * 100))}>
                {perf?.xirr != null ? formatPct(perf.xirr * 100, { locale }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-anthracite-500">{t('perf.drawdown')}</p>
              <p className="text-sm font-bold tabular text-loss-600">
                {drawdown.length
                  ? formatPct(Math.min(...drawdown.map((d) => d.drawdown)), {
                      locale,
                      decimals: 2,
                      sign: false,
                    })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-anthracite-500">{t('dash.topGainers')}</p>
              <p className="truncate text-sm font-bold text-ink">
                {topWeight ? `${topWeight.ticker} · ${formatPct(topWeight.weight, { locale, decimals: 1, sign: false })}` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Répartitions */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-600" /> {t('dash.allocation')}
            </CardTitle>
            <Badge variant="outline">
              {snapshot.positions.length} lignes · {t('dash.liquidity')}
            </Badge>
          </CardHeader>
          <CardContent>
            {allocation.length === 0 ? (
              <EmptyState title={t('common.empty')} />
            ) : (
              <DonutChart
                slices={allocation}
                centerValue={<Money value={snapshot.totalValue} decimals={0} compact />}
                centerLabel="MAD"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-anthracite-500" /> {t('dash.sectors')}
            </CardTitle>
            <Badge variant="outline">% du portefeuille</Badge>
          </CardHeader>
          <CardContent>
            {sectors.length === 0 ? (
              <EmptyState title={t('common.empty')} />
            ) : (
              <HBarList rows={sectors} height={230} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gagnants / perdants / événements */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <TopMovers direction="up" />
        <TopMovers direction="down" />
        <UpcomingEvents />
      </div>

      {snapshot.positions.length > 0 ? (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600" /> Vos principales lignes
            </CardTitle>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/actions">
                  <TrendingUp /> {t('nav.actions')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/opcvm">
                  <TrendingDown className="rotate-180" /> {t('nav.opcvm')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {snapshot.positions.slice(0, 6).map((p) => {
                const q = quoteById.get(p.instrumentId)
                const inst = instrumentById.get(p.instrumentId)
                return (
                  <li key={p.instrumentId}>
                    <Link
                      to={p.type === 'OPCVM' ? `/opcvm/${p.instrumentId}` : `/actions/${p.instrumentId}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="block text-[11px] text-muted">
                          {p.quantity} × {formatNumber(p.pru, { locale, decimals: 2 })} MAD
                        </span>
                      </span>
                      <span className="text-end">
                        <Money value={p.marketValue} className="block text-sm font-bold" />
                        <Delta value={q?.changePct ?? 0} iconSize="xs" className="text-xs" />
                      </span>
                      <span className="hidden w-14 text-end text-xs font-semibold text-anthracite-500 sm:block">
                        {formatPct(p.weight, { locale, decimals: 1, sign: false })}
                      </span>
                      {inst ? null : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
