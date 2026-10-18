import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, Building2, Layers, PieChart, ShieldCheck } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, PageHeader, SkeletonRows } from '@/components/shared/page'
import { Delta, MiniStat, StatCard } from '@/components/shared/stat-card'
import { Money } from '@/components/shared/money'
import { WatchButton } from '@/components/shared/watch-button'
import { UpdatePriceDialog } from '@/components/shared/update-price-dialog'
import { PriceChart, RangeTabs } from '@/components/shared/charts'
import { formatDate, formatNumber, formatPct, signClass } from '@/lib/format'
import type { RangeKey } from '@/domain/types'

const SPANS: Record<RangeKey, number> = {
  '1J': 7,
  '1S': 15,
  '1M': 31,
  '3M': 92,
  '6M': 183,
  '1A': 366,
  MAX: 10_000,
}

export default function ActionDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const t = useT()
  const { locale } = useI18n()
  const { instrumentById, quoteById, snapshot, transactions, priceHistory, loading } = useStore()
  const [range, setRange] = React.useState<RangeKey>('1A')

  const instrument = instrumentById.get(id)
  const quote = quoteById.get(id)

  const history = React.useMemo(() => {
    const full = priceHistory.get(id) ?? []
    if (full.length === 0) return []
    const end = full[full.length - 1].date
    const from = new Date(Date.parse(end) - SPANS[range] * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const sliced = full.filter((p) => p.date >= from)
    return sliced.length >= 2 ? sliced : full.slice(-2)
  }, [priceHistory, id, range])

  const position = React.useMemo(
    () => snapshot?.positions.find((p) => p.instrumentId === id) ?? null,
    [snapshot, id],
  )

  const myTx = React.useMemo(
    () =>
      transactions
        .filter((tx) => tx.instrumentId === id)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, id],
  )

  const periodReturn = React.useMemo(() => {
    if (history.length < 2) return null
    const first = history[0].close
    const last = history[history.length - 1].close
    return first > 0 ? ((last / first) - 1) * 100 : null
  }, [history])

  if (loading) {
    return (
      <>
        <PageHeader title={t('common.loading')} />
        <Card>
          <CardContent>
            <SkeletonRows rows={6} />
          </CardContent>
        </Card>
      </>
    )
  }

  if (!instrument || instrument.type !== 'ACTION') {
    return (
      <>
        <PageHeader title={t('actions.detail')} />
        <EmptyState
          title="Valeur introuvable"
          description="Cette valeur n'existe pas dans le référentiel (jeu de démonstration)."
          action={
            <Button asChild>
              <Link to="/actions">{t('common.back')}</Link>
            </Button>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link
              to="/actions"
              aria-label={t('common.back')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-anthracite-500 transition-colors hover:bg-anthracite-100 hover:text-ink dark:hover:bg-anthracite-800"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
            {instrument.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{instrument.ticker}</Badge>
            <Badge variant="outline">{instrument.sector ?? '—'}</Badge>
            <span className="text-xs">{instrument.market ?? 'Bourse de Casablanca'}</span>
            {instrument.isin ? (
              <span className="font-mono text-[11px] text-anthracite-400">{instrument.isin}</span>
            ) : null}
          </span>
        }
        actions={
          <>
            <WatchButton instrumentId={id} />
            <UpdatePriceDialog
              instrumentId={id}
              label={instrument.name}
              currentPrice={quote?.close ?? position?.lastPrice ?? 0}
            />
          </>
        }
      />

      {/* Cours + variation du jour */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label={t('actions.last')}
          value={quote?.close ?? 0}
          delta={quote?.changePct ?? 0}
          hint={quote ? formatDate(quote.date, locale) : undefined}
          accent="brand"
        />
        {quote?.marketCap ? (
          <StatCard label={t('actions.cap')} value={quote.marketCap} icon={<Layers className="h-4 w-4" />} />
        ) : null}
        {quote?.volume ? (
          <StatCard
            label={t('actions.volume')}
            value={quote.volume}
            icon={<PieChart className="h-4 w-4" />}
          />
        ) : null}
        {quote?.per ? (
          <StatCard
            label={t('actions.per')}
            value={quote.per}
            icon={<ShieldCheck className="h-4 w-4" />}
            hint="Cours / BPA"
          />
        ) : null}
      </div>

      {/* Graphe du cours */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            Évolution du cours
            {periodReturn !== null ? (
              <span className={`ms-2 text-sm font-bold ${signClass(periodReturn)}`}>
                {formatPct(periodReturn, { locale, decimals: 1 })}
              </span>
            ) : null}
          </p>
          <RangeTabs value={range} onChange={setRange} />
        </div>
        {history.length === 0 ? (
          <EmptyState title="Pas d'historique disponible" />
        ) : (
          <PriceChart data={history} label={instrument.ticker} />
        )}
        <p className="mt-2 text-[11px] text-muted">{t('app.disclaimer')}</p>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Dividende */}
        <Card className="p-3 sm:p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Dividende</p>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Dividende brut / action">
              <Money value={quote?.dividendPerShare ?? 0} decimals={2} />
            </MiniStat>
            <MiniStat label={t('actions.yield')}>
              {formatPct(quote?.dividendYield ?? 0, { locale, decimals: 2, sign: false })}
            </MiniStat>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Rendement calculé sur le dernier dividende connu et le cours de clôture. Retenue à la
            source de 15 % appliquée à l'encaissement (paramétrable dans la Fiscalité).
          </p>
        </Card>

        {/* Ma position */}
        <Card className="p-3 sm:p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Ma position</p>
          {!position ? (
            <EmptyState
              title="Aucune ligne sur cette valeur"
              description="Vous ne détenez pas encore cette action dans le portefeuille actif."
              className="py-6"
              action={
                <Button asChild size="sm">
                  <Link to="/operations">{t('ops.add')}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label={t('common.quantity')}>
                {formatNumber(position.quantity, { locale, decimals: 0 })}
              </MiniStat>
              <MiniStat label={t('actions.pru')}>
                <Money value={position.pru} decimals={2} />
              </MiniStat>
              <MiniStat label={t('common.value')}>
                <Money value={position.marketValue} className="text-base" />
              </MiniStat>
              <MiniStat label={t('actions.unrealized')}>
                <span className={signClass(position.unrealizedPnl)}>
                  <Money value={position.unrealizedPnl} hideMaskable reveal />
                </span>
              </MiniStat>
              <MiniStat label={t('common.share')}>
                {formatPct(position.weight, { locale, decimals: 1, sign: false })}
              </MiniStat>
              <MiniStat label={t('perf.realized')}>
                <span className={signClass(position.realizedPnl)}>
                  <Money value={position.realizedPnl} hideMaskable reveal />
                </span>
              </MiniStat>
              <MiniStat label={t('perf.dividends')}>
                <Money value={position.income} />
              </MiniStat>
              <MiniStat label={t('dash.invested')}>
                <Money value={position.invested} />
              </MiniStat>
            </div>
          )}
        </Card>
      </div>

      {/* Mes opérations */}
      <Card className="p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-ink">{t('actions.myOps')}</p>
          <Badge variant="outline">{myTx.length}</Badge>
        </div>
        {myTx.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Aucune opération" description="Ajoutez vos achats, ventes ou dividendes dans le journal." />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <Table className="hidden md:table">
              <THead>
                <TR>
                  <TH>{t('common.date')}</TH>
                  <TH>{t('common.type')}</TH>
                  <TH align="end">{t('common.quantity')}</TH>
                  <TH align="end">{t('common.price')}</TH>
                  <TH align="end">{t('common.fees')}</TH>
                  <TH align="end">{t('common.taxes')}</TH>
                  <TH align="end">{t('common.amount')}</TH>
                </TR>
              </THead>
              <TBody>
                {myTx.map((tx) => {
                  const gross = (tx.quantity ?? 0) * (tx.price ?? 0)
                  const total =
                    tx.type === 'DIVIDENDE' || tx.type === 'COUPON'
                      ? (tx.amount ?? 0)
                      : tx.type === 'VENTE'
                        ? gross - (tx.fees ?? 0) - (tx.taxes ?? 0)
                        : gross + (tx.fees ?? 0) + (tx.taxes ?? 0)
                  return (
                    <TR key={tx.id}>
                      <TD>{formatDate(tx.date, locale)}</TD>
                      <TD>
                        <Badge variant={tx.type === 'VENTE' ? 'loss' : tx.type === 'ACHAT' ? 'gain' : 'secondary'}>
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </TD>
                      <TD align="end">{tx.quantity ? formatNumber(tx.quantity, { locale, decimals: 0 }) : '—'}</TD>
                      <TD align="end">{tx.price ? formatNumber(tx.price, { locale, decimals: 2 }) : '—'}</TD>
                      <TD align="end">{tx.fees ? formatNumber(tx.fees, { locale, decimals: 2 }) : '—'}</TD>
                      <TD align="end">{tx.taxes ? formatNumber(tx.taxes, { locale, decimals: 2 }) : '—'}</TD>
                      <TD align="end">
                        <span className={signClass(total)}>
                          <Money value={total} hideMaskable reveal />
                        </span>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            {/* Mobile */}
            <ul className="divide-y divide-border md:hidden">
              {myTx.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-ink">{tx.type.replace('_', ' ')}</p>
                    <p className="text-[11px] text-muted">{formatDate(tx.date, locale)}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold tabular">
                      {tx.quantity ? `${formatNumber(tx.quantity, { locale, decimals: 0 })} × ` : ''}
                      {tx.price ? formatNumber(tx.price, { locale, decimals: 2 }) : ''}
                      {!tx.price && tx.amount ? formatNumber(tx.amount, { locale, decimals: 2 }) : ''}
                    </p>
                    <p className="text-[11px] text-muted">MAD</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Mention légale */}
      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {t('app.legal')} <Bell className="inline h-3 w-3" />
        </span>
      </p>
    </>
  )
}
