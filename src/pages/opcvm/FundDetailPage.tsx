import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Building2, CalendarClock, Percent, Scale } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, PageHeader, SkeletonRows } from '@/components/shared/page'
import { Delta, MiniStat } from '@/components/shared/stat-card'
import { Money } from '@/components/shared/money'
import { WatchButton } from '@/components/shared/watch-button'
import { UpdatePriceDialog } from '@/components/shared/update-price-dialog'
import { PriceChart, RangeTabs } from '@/components/shared/charts'
import { formatDate, formatNumber, formatPct, signClass } from '@/lib/format'
import type { PricePoint, RangeKey } from '@/domain/types'

const SPANS: Record<RangeKey, number> = {
  '1J': 7,
  '1S': 15,
  '1M': 31,
  '3M': 92,
  '6M': 183,
  '1A': 366,
  MAX: 10_000,
}

const RISK_LABELS = ['Très faible', 'Faible', 'Modéré', 'Modéré +', 'Élevé', 'Très élevé', 'Maximum']

/** Carte de performance (affiche un rendement en %, pas un montant) */
function PerfCard({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const { locale } = useI18n()
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">{label}</p>
        <p className={`text-2xl font-bold leading-none tabular ${signClass(value ?? 0)}`}>
          {value === null ? '—' : formatPct(value, { locale, decimals: 2 })}
        </p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

/** Rendement sur une fenêtre glissante, calculé sur l'historique de VL */
function windowReturn(history: PricePoint[], days: number): number | null {
  if (history.length < 2) return null
  const end = history[history.length - 1]
  const from = new Date(Date.parse(end.date) - days * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const start = [...history].reverse().find((p) => p.date <= from)
  if (!start || start.close <= 0) return null
  return (end.close / start.close - 1) * 100
}

/** Rendement depuis le 1er janvier de l'année courante */
function ytdReturn(history: PricePoint[]): number | null {
  if (history.length < 2) return null
  const year = history[history.length - 1].date.slice(0, 4)
  const start = history.find((p) => p.date >= `${year}-01-01`)
  if (!start || start.close <= 0) return null
  return (history[history.length - 1].close / start.close - 1) * 100
}

export default function FundDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const t = useT()
  const { locale } = useI18n()
  const { instrumentById, quoteById, snapshot, transactions, priceHistory, loading } = useStore()
  const [range, setRange] = React.useState<RangeKey>('1A')

  const instrument = instrumentById.get(id)
  const quote = quoteById.get(id)

  const fullHistory = React.useMemo(() => priceHistory.get(id) ?? [], [priceHistory, id])

  const history = React.useMemo(() => {
    if (fullHistory.length === 0) return []
    const end = fullHistory[fullHistory.length - 1].date
    const from = new Date(Date.parse(end) - SPANS[range] * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const sliced = fullHistory.filter((p) => p.date >= from)
    return sliced.length >= 2 ? sliced : fullHistory.slice(-2)
  }, [fullHistory, range])

  const perfs = React.useMemo(
    () => ({
      ytd: ytdReturn(fullHistory),
      y1: windowReturn(fullHistory, 366),
      y3: windowReturn(fullHistory, 366 * 3),
      max: windowReturn(fullHistory, 10_000),
    }),
    [fullHistory],
  )

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

  if (!instrument || instrument.type !== 'OPCVM') {
    return (
      <>
        <PageHeader title={t('opcvm.detail')} />
        <EmptyState
          title="Fonds introuvable"
          description="Ce fonds n'existe pas dans le référentiel (jeu de démonstration)."
          action={
            <Button asChild>
              <Link to="/opcvm">{t('common.back')}</Link>
            </Button>
          }
        />
      </>
    )
  }

  const fees = instrument.fees

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link
              to="/opcvm"
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
            <Badge variant="secondary">{instrument.managementCompany ?? '—'}</Badge>
            {instrument.category ? <Badge variant="outline">{instrument.category}</Badge> : null}
            <span className="font-mono text-[11px] text-anthracite-400">{instrument.isin ?? ''}</span>
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

      {/* VL + performances clés */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
              {t('opcvm.nav')} (MAD)
            </p>
            <p className="text-2xl font-bold leading-none text-ink tabular">
              {formatNumber(quote?.close ?? 0, { locale, decimals: 3 })}
            </p>
            <p className="text-xs text-muted">
              {quote ? `${t('opcvm.navDate')} : ${formatDate(quote.date, locale)}` : '—'}
            </p>
          </CardContent>
        </Card>
        <PerfCard label="Performance YTD" value={perfs.ytd} hint="Depuis le 1er janvier" />
        <PerfCard label="Performance 1 an" value={perfs.y1} />
        <PerfCard label="Performance 3 ans" value={perfs.y3} />
      </div>

      {/* Graphique de VL */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            Historique de la VL
            {perfs.max !== null ? (
              <span className={`ms-2 text-sm font-bold ${signClass(perfs.max)}`}>
                {formatPct(perfs.max, { locale, decimals: 1 })}
              </span>
            ) : null}
          </p>
          <RangeTabs value={range} onChange={setRange} />
        </div>
        {history.length === 0 ? (
          <EmptyState title="Pas d'historique de VL disponible" />
        ) : (
          <PriceChart data={history} label={instrument.name} />
        )}
        <p className="mt-2 text-[11px] text-muted">
          VL publiée en J ou J+1 selon la catégorie du fonds · {t('app.disclaimer')}
        </p>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Fiche du fonds */}
        <Card className="p-3 sm:p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Caractéristiques du fonds</p>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label={t('opcvm.company')}>{instrument.managementCompany ?? '—'}</MiniStat>
            <MiniStat label={t('opcvm.benchmark')}>{instrument.benchmark ?? '—'}</MiniStat>
            <MiniStat label={t('opcvm.risk')}>
              <span className="inline-flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                {instrument.riskLevel ?? '—'}/7 · {RISK_LABELS[(instrument.riskLevel ?? 1) - 1]}
              </span>
            </MiniStat>
            <MiniStat label="Devise">{instrument.currency}</MiniStat>
          </div>

          <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            <Percent className="h-3.5 w-3.5" /> {t('opcvm.feesEntry')} / {t('opcvm.feesExit')} /{' '}
            {t('opcvm.feesMgmt')}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-anthracite-50 px-3 py-2 text-center dark:bg-anthracite-900/40">
              <p className="text-lg font-bold text-ink tabular">{fees?.entry ?? 0} %</p>
              <p className="text-[10px] uppercase text-anthracite-500">Entrée</p>
            </div>
            <div className="rounded-lg bg-anthracite-50 px-3 py-2 text-center dark:bg-anthracite-900/40">
              <p className="text-lg font-bold text-ink tabular">{fees?.exit ?? 0} %</p>
              <p className="text-[10px] uppercase text-anthracite-500">Sortie</p>
            </div>
            <div className="rounded-lg bg-anthracite-50 px-3 py-2 text-center dark:bg-anthracite-900/40">
              <p className="text-lg font-bold text-ink tabular">{fees?.management ?? 0} %</p>
              <p className="text-[10px] uppercase text-anthracite-500">Gestion / an</p>
            </div>
          </div>

          {instrument.policy ? (
            <div className="mt-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                <Building2 className="h-3.5 w-3.5" /> {t('opcvm.policy')}
              </p>
              <p className="text-xs leading-relaxed text-anthracite-600 dark:text-anthracite-300">
                {instrument.policy}
              </p>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Les performances passées ne préjugent pas des performances futures. Les frais de
              gestion réduisent la performance annuelle affichée.
            </span>
          </p>
        </Card>

        {/* Ma position */}
        <Card className="p-3 sm:p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Ma position</p>
          {!position ? (
            <EmptyState
              title="Aucune part détenue"
              description="Vous ne détenez pas encore ce fonds dans le portefeuille actif."
              className="py-6"
              action={
                <Button asChild size="sm">
                  <Link to="/operations">{t('ops.add')}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label={t('opcvm.parts')}>
                {formatNumber(position.quantity, { locale, decimals: 2 })}
              </MiniStat>
              <MiniStat label={t('opcvm.avgNav')}>
                <Money value={position.pru} decimals={3} />
              </MiniStat>
              <MiniStat label={t('common.value')}>
                <Money value={position.marketValue} className="text-base" />
              </MiniStat>
              <MiniStat label={t('actions.unrealized')}>
                <span className={signClass(position.unrealizedPnl)}>
                  <Money value={position.unrealizedPnl} hideMaskable reveal />
                </span>
                <Delta value={position.unrealizedPnlPct} iconSize="xs" />
              </MiniStat>
              <MiniStat label={t('common.share')}>
                {formatPct(position.weight, { locale, decimals: 1, sign: false })}
              </MiniStat>
              <MiniStat label={t('perf.realized')}>
                <span className={signClass(position.realizedPnl)}>
                  <Money value={position.realizedPnl} hideMaskable reveal />
                </span>
              </MiniStat>
            </div>
          )}

          <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            <CalendarClock className="h-3.5 w-3.5" /> {t('actions.myOps')}
          </p>
          {myTx.length === 0 ? (
            <p className="text-xs text-muted">Aucune opération sur ce fonds.</p>
          ) : (
            <ul className="divide-y divide-border">
              {myTx.slice(0, 8).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-ink">{tx.type.replace('_', ' ')}</p>
                    <p className="text-[11px] text-muted">{formatDate(tx.date, locale)}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold tabular">
                      {tx.quantity ? `${formatNumber(tx.quantity, { locale, decimals: 2 })} × ` : ''}
                      {tx.price ? formatNumber(tx.price, { locale, decimals: 3 }) : ''}
                      {!tx.price && tx.amount ? formatNumber(tx.amount, { locale, decimals: 2 }) : ''}
                    </p>
                    <p className="text-[11px] text-muted">MAD</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Dernières VL publiées */}
      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-ink">Dernières VL publiées</p>
        </div>
        {fullHistory.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Aucune VL publiée" />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('opcvm.navDate')}</TH>
                <TH align="end">{t('opcvm.nav')} (MAD)</TH>
                <TH align="end">Variation</TH>
              </TR>
            </THead>
            <TBody>
              {fullHistory
                .slice(-10)
                .reverse()
                .map((p, i, arr) => {
                  const prev = arr[i + 1]
                  const change = prev && prev.close > 0 ? (p.close / prev.close - 1) * 100 : null
                  return (
                    <TR key={p.date}>
                      <TD>{formatDate(p.date, locale)}</TD>
                      <TD align="end">
                        <span className="font-semibold">{formatNumber(p.close, { locale, decimals: 3 })}</span>
                      </TD>
                      <TD align="end">
                        {change !== null ? <Delta value={change} iconSize="xs" /> : '—'}
                      </TD>
                    </TR>
                  )
                })}
            </TBody>
          </Table>
        )}
      </Card>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">{t('app.legal')}</p>
    </>
  )
}
