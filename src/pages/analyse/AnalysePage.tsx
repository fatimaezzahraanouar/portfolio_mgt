import * as React from 'react'
import {
  Activity,
  Banknote,
  Gauge,
  Landmark,
  LineChart,
  Percent,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import { computeContributions, computeRisk, drawdownSeries, rebase } from '@/domain/calc'
import type { PricePoint, RangeKey } from '@/domain/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/controls'
import { EmptyState, PageHeader, SkeletonCards, SkeletonRows } from '@/components/shared/page'
import { CardWithHeader, MiniStat, StatCard } from '@/components/shared/stat-card'
import { MaskToggle, Money } from '@/components/shared/money'
import { DrawdownChart, HBarList, PortfolioChart, RangeTabs } from '@/components/shared/charts'
import { formatDate, formatPct, signClass } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  CompareTable,
  ConcentrationList,
  ContributionTable,
  IncomeCard,
  PctCard,
  SignedMoneyCard,
  type CompareRow,
} from './components'

/** Seuil de vigilance concentration (en % du portefeuille) */
const CONCENTRATION_THRESHOLD = 20
/** Identifiant du fonds monétaire de référence (benchmark « cash ») */
const MONEY_FUND_ID = 'OPC_ATM'

/* ------------------------------------------------------------------ */
/* Page « Performance & analyse »                                      */
/* ------------------------------------------------------------------ */

export default function AnalysePage() {
  const t = useT()
  const { locale } = useI18n()
  const {
    snapshot,
    loading,
    seriesOf,
    performanceOf,
    priceHistory,
    provider,
    activeId,
    activePortfolio,
    instrumentById,
  } = useStore()

  const [range, setRange] = React.useState<RangeKey>('1A')
  const [showMasi, setShowMasi] = React.useState(true)
  const [masi, setMasi] = React.useState<PricePoint[]>([])
  const [money, setMoney] = React.useState<PricePoint[]>([])

  /* Historiques des benchmarks (différés) */
  React.useEffect(() => {
    let alive = true
    void Promise.all([
      provider.getIndexHistory('MASI'),
      provider.getPriceHistory(MONEY_FUND_ID),
    ])
      .then(([masiHistory, moneyHistory]) => {
        if (!alive) return
        setMasi(masiHistory)
        setMoney(moneyHistory)
      })
      .catch(() => {
        /* benchmark indisponible : la page reste affichée sans comparaison */
      })
    return () => {
      alive = false
    }
  }, [provider])

  /* ------------------------- calculs mémorisés ------------------------- */

  const series = React.useMemo(() => seriesOf(range), [seriesOf, range])
  const perf = React.useMemo(() => performanceOf(range), [performanceOf, range])

  const dates = React.useMemo(() => series.map((p) => p.date), [series])

  const chartData = React.useMemo(
    () => series.map((p) => ({ date: p.date, value: p.value, pct: p.twrPct })),
    [series],
  )

  const masiRebased = React.useMemo(
    () => (masi.length && dates.length ? rebase(masi, dates) : []),
    [masi, dates],
  )
  const moneyRebased = React.useMemo(
    () => (money.length && dates.length ? rebase(money, dates) : []),
    [money, dates],
  )

  const from = range === 'MAX' ? undefined : series[0]?.date
  const contributions = React.useMemo(
    () => (snapshot ? computeContributions(snapshot.positions, priceHistory, from) : []),
    [snapshot, priceHistory, from],
  )
  const contributionBars = React.useMemo(
    () =>
      contributions.map((c) => ({
        key: c.instrumentId,
        label: c.ticker,
        value: c.contribution,
      })),
    [contributions],
  )

  const weights = React.useMemo(
    () =>
      (snapshot?.positions ?? []).map((p) => ({
        instrumentId: p.instrumentId,
        name: p.name,
        weight: p.weight,
      })),
    [snapshot],
  )
  const risk = React.useMemo(
    () => computeRisk({ series, weights, concentrationThreshold: CONCENTRATION_THRESHOLD }),
    [series, weights],
  )
  const drawdown = React.useMemo(() => drawdownSeries(series), [series])
  const maxDrawdownPct = drawdown.length
    ? Math.min(...drawdown.map((d) => d.drawdown))
    : risk.maxDrawdown * 100

  const periodLabel =
    series.length >= 2
      ? `${formatDate(series[0].date, locale)} → ${formatDate(series[series.length - 1].date, locale)}`
      : ''

  const moneyFundName =
    instrumentById.get(MONEY_FUND_ID)?.name ?? t('perf.moneyBenchmark', 'Benchmark monétaire')

  /* ----------------------------- état vide ----------------------------- */

  const header = (
    <PageHeader
      title={t('perf.title', 'Performance & analyse')}
      description={`${t('app.disclaimer')} · ${periodLabel || t('common.loading', 'Chargement…')}`}
      actions={
        <>
          <MaskToggle />
          <RangeTabs value={range} onChange={setRange} />
        </>
      }
    />
  )

  if (loading) {
    return (
      <>
        {header}
        <SkeletonCards count={4} />
        <div className="mt-3">
          <SkeletonCards count={3} />
        </div>
        <div className="mt-3">
          <SkeletonRows rows={5} />
        </div>
      </>
    )
  }

  if (!snapshot || series.length < 2) {
    return (
      <>
        {header}
        <EmptyState
          title={t('perf.emptyTitle', 'Pas encore de données à analyser')}
          description={t(
            'perf.emptyDesc',
            'Ajoutez des opérations (achats, ventes, dividendes…) pour voir la performance, les contributions et les indicateurs de risque.',
          )}
        />
      </>
    )
  }

  /* --------------------------- valeurs dérivées ------------------------ */

  const twrPct = (perf?.twr ?? 0) * 100
  const simplePct = (perf?.simpleReturn ?? 0) * 100
  const xirrPct = perf?.xirr != null ? perf.xirr * 100 : null
  const annualizedPct = perf?.annualized != null ? perf.annualized * 100 : null

  const gainNet =
    snapshot.totalValue + (perf?.withdrawals ?? 0) - (perf?.deposits ?? 0)

  const income = snapshot.cash.income
  const invested = snapshot.invested
  const yieldOnCost = invested > 0 ? (income / invested) * 100 : 0

  const masiPct = masiRebased.length ? masiRebased[masiRebased.length - 1].pct : null
  const moneyPct = moneyRebased.length ? moneyRebased[moneyRebased.length - 1].pct : null

  const compareRows: CompareRow[] = [
    {
      key: 'pf',
      label: t('perf.portfolioLine', 'Portefeuille (TWR)'),
      sub: activeId === 'all' ? t('common.all', 'Tous les portefeuilles') : (activePortfolio?.name ?? ''),
      value: twrPct,
      diff: null,
    },
    {
      key: 'masi',
      label: 'MASI',
      sub: t('perf.masiSub', 'Indice large Bourse de Casablanca'),
      value: masiPct,
      diff: masiPct != null ? masiPct - twrPct : null,
    },
    {
      key: 'money',
      label: moneyFundName,
      sub: t('perf.moneySub', 'VL d’un fonds monétaire (benchmark de trésorerie)'),
      value: moneyPct,
      diff: moneyPct != null ? moneyPct - twrPct : null,
    },
  ]

  const topConcentration = risk.concentration[0]

  return (
    <>
      {header}

      {/* ---------------- 4 indicateurs de performance ---------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PctCard
          label={t('perf.simple', 'Performance simple')}
          value={simplePct}
          icon={<Percent className="h-4 w-4" />}
          hint={t('perf.simpleHint', 'Gain net / versements cumulés — depuis l’origine')}
        />
        <PctCard
          label={t('perf.twr', 'TWR (time-weighted)')}
          value={twrPct}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={
            annualizedPct != null
              ? `${t('perf.annualized', 'Annualisé')} : ${formatPct(annualizedPct, { locale, decimals: 2 })}`
              : t('perf.twrHint', 'Hors effet des flux (versements / retraits)')
          }
        />
        <PctCard
          label={t('perf.xirr', 'XIRR (taux interne)')}
          value={xirrPct}
          icon={<Gauge className="h-4 w-4" />}
          hint={t('perf.xirrHint', 'Taux interne annualisé pondéré par le calendrier de vos flux')}
        />
        <StatCard
          label={t('perf.vsFlows', 'Performance (gain net vs versements)')}
          value={gainNet}
          delta={simplePct}
          deltaLabel={t('perf.vsFlowsDelta', 'vs versements cumulés')}
          hint={
            <>
              {t('common.total', 'Total')} : <Money value={snapshot.totalValue} reveal hideMaskable /> ·{' '}
              {t('perf.deposits', 'Versements')} : <Money value={perf?.deposits ?? 0} reveal hideMaskable />
            </>
          }
          icon={<Banknote className="h-4 w-4" />}
          accent="brand"
        />
      </div>

      {/* --------------- plus-values, dividendes, rendement -------------- */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SignedMoneyCard
          label={t('perf.realized', 'Plus-values réalisées')}
          value={snapshot.realizedPnl}
          icon={<Landmark className="h-4 w-4" />}
          hint={t('perf.realizedHint', 'Gain net des ventes et rachats encaissés')}
        />
        <SignedMoneyCard
          label={t('perf.unrealized', 'Plus-values latentes')}
          value={snapshot.unrealizedPnl}
          icon={<LineChart className="h-4 w-4" />}
          hint={t('perf.unrealizedHint', 'Valorisation actuelle des titres détenus vs coût')}
        />
        <IncomeCard
          label={t('perf.dividends', 'Dividendes & coupons encaissés')}
          value={income}
          yieldPct={yieldOnCost}
          yieldLabel={t('perf.yieldOnCost', 'Rendement sur coût')}
          hint={
            <>
              {t('perf.onInvested', 'sur capital investi')} <Money value={invested} reveal hideMaskable />
            </>
          }
        />
      </div>

      {/* ----------------------- évolution vs MASI ---------------------- */}
      <Card className="mt-3">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <LineChart className="h-4 w-4 text-brand-600" />
              {t('perf.evolution', 'Évolution du portefeuille')}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted">
              {t('perf.vsMasi', 'Comparaison au MASI')} — {t('perf.rebaseNote', 'séries rebaseées à 0 % sur la fenêtre')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{periodLabel}</Badge>
            <label className="flex items-center gap-2 text-xs font-medium text-anthracite-600 dark:text-anthracite-300">
              MASI
              <Switch
                checked={showMasi}
                onCheckedChange={(v) => setShowMasi(Boolean(v))}
                aria-label={t('perf.toggleMasi', 'Afficher ou masquer le MASI')}
              />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <PortfolioChart
            data={chartData}
            benchmark={masiRebased}
            benchmarkName="MASI"
            showBenchmark={showMasi && masiRebased.length > 0}
            height={280}
          />
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
            <MiniStat label={t('perf.twr', 'TWR (time-weighted)')}>
              <span className={signClass(twrPct)}>{formatPct(twrPct, { locale, decimals: 2 })}</span>
            </MiniStat>
            <MiniStat label="MASI">
              <span className={signClass(masiPct ?? 0)}>
                {masiPct != null ? formatPct(masiPct, { locale, decimals: 2 }) : '—'}
              </span>
            </MiniStat>
            <MiniStat label={t('perf.gapPortfolio', 'Écart vs portefeuille')}>
              <span className={signClass(masiPct != null ? masiPct - twrPct : 0)}>
                {masiPct != null ? formatPct(masiPct - twrPct, { locale, decimals: 2 }) : '—'}
              </span>
            </MiniStat>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- contribution de chaque ligne ---------------- */}
      <CardWithHeader
        className="mt-3"
        title={
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            {t('perf.contribution', 'Contribution à la performance')}
          </span>
        }
        action={<Badge variant="secondary">{t('perf.contributionUnit', 'en points de pourcentage')}</Badge>}
      >
        {contributions.length === 0 ? (
          <EmptyState title={t('common.empty', 'Aucune donnée')} />
        ) : (
          <>
            <HBarList rows={contributionBars} unit="pts" height={Math.min(280, 80 + contributions.length * 30)} />
            <div className="mt-3 border-t border-border pt-3">
              <ContributionTable rows={contributions} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t(
                'perf.contributionHint',
                'Contribution ≈ poids moyen de la ligne × rendement de la ligne sur la période. Elle explique l’écart entre la performance globale et chaque position.',
              )}
            </p>
          </>
        )}
      </CardWithHeader>

      {/* --------------------------- indicateurs de risque ---------------- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-brand-600" />
              {t('perf.risk', 'Indicateurs de risque')}
            </CardTitle>
            <Badge variant="outline">{series.length} {t('perf.sessions', 'séances')}</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <MiniStat label={t('perf.volatility', 'Volatilité annualisée')}>
                <span className="text-base">
                  {formatPct(risk.volatility * 100, { locale, decimals: 1, sign: false })}
                </span>
              </MiniStat>
              <MiniStat label={t('perf.drawdown', 'Drawdown max')}>
                <span className="text-base text-loss-600 dark:text-loss-500">
                  {formatPct(maxDrawdownPct, { locale, decimals: 2, sign: false })}
                </span>
              </MiniStat>
              <MiniStat label={t('perf.worstDay', 'Pire journée')}>
                <span className={cn('text-base', signClass(risk.worstDay * 100))}>
                  {formatPct(risk.worstDay * 100, { locale, decimals: 2 })}
                </span>
              </MiniStat>
              <MiniStat label={t('perf.bestDay', 'Meilleure journée')}>
                <span className={cn('text-base', signClass(risk.bestDay * 100))}>
                  {formatPct(risk.bestDay * 100, { locale, decimals: 2 })}
                </span>
              </MiniStat>
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-anthracite-500">
                {t('perf.drawdownSeries', 'Drawdown depuis le plus haut')}
              </p>
              <DrawdownChart data={drawdown} height={150} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              {t('perf.concentration', 'Concentration')}
            </CardTitle>
            <Badge variant={risk.isConcentrated ? 'warning' : 'outline'}>
              {t('perf.threshold', 'Seuil')} : {CONCENTRATION_THRESHOLD} %
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                {t('perf.maxConcentration', 'Ligne la plus lourde')}
              </span>
              <span
                className={cn(
                  'text-lg font-bold tabular',
                  risk.maxConcentration > CONCENTRATION_THRESHOLD
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-ink',
                )}
              >
                {formatPct(risk.maxConcentration, { locale, decimals: 1, sign: false })}
              </span>
            </div>
            {risk.isConcentrated ? (
              <Alert variant="warning" title={t('perf.concentrationAlert', 'Ligne supérieure à 20 % du portefeuille')}>
                {topConcentration
                  ? `${topConcentration.name} pèse ${formatPct(topConcentration.weight, {
                      locale,
                      decimals: 1,
                      sign: false,
                    })} du portefeuille — ${t(
                      'perf.concentrationAdvice',
                      'au-delà de 20 %, la performance dépend fortement d’une seule ligne : envisagez une diversification.',
                    )}`
                  : t('perf.concentrationAdvice', 'au-delà de 20 %, la performance dépend fortement d’une seule ligne : envisagez une diversification.')}
              </Alert>
            ) : (
              <p className="text-xs leading-relaxed text-muted">
                {t(
                  'perf.concentrationOk',
                  'Aucune ligne ne dépasse le seuil de vigilance : la répartition est équilibrée.',
                )}
              </p>
            )}
            <ConcentrationList rows={risk.concentration} threshold={CONCENTRATION_THRESHOLD} />
          </CardContent>
        </Card>
      </div>

      {/* --------------- benchmark monétaire & comparatif ---------------- */}
      <CardWithHeader
        className="mt-3"
        title={
          <span className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-anthracite-500" />
            {t('perf.compare', 'Comparaison de benchmarks')}
          </span>
        }
        action={<Badge variant="secondary">{moneyFundName}</Badge>}
      >
        <p className="mb-3 text-xs leading-relaxed text-muted">
          {t(
            'perf.moneyExplain',
            'Repère « monétaire » : évolution de la VL d’un fonds de trésorerie (catégorie monétaire), rebaseée sur la même fenêtre que votre portefeuille — un rendement positif mais inférieur à l’inflation signifie un pouvoir d’achat en baisse.',
          )}
        </p>
        {moneyRebased.length > 0 ? (
          <PortfolioChart
            data={chartData}
            benchmark={moneyRebased}
            benchmarkName={moneyFundName}
            showBenchmark
            height={220}
          />
        ) : (
          <EmptyState
            title={t('perf.noMoneyHistory', 'Historique du fonds monétaire indisponible')}
            description={t('perf.noMoneyDesc', 'La série de VL n’a pas pu être chargée pour cette période.')}
          />
        )}
        <div className="mt-3 border-t border-border pt-3">
          <CompareTable rows={compareRows} />
        </div>
      </CardWithHeader>

      {/* --------------------------- note de bas de page ------------------ */}
      <Alert variant="info" className="mt-3" title={t('app.disclaimer', 'Données différées / à titre indicatif')}>
        {t(
          'perf.footerNote',
          'Les cours et VL sont différés et fournis à titre indicatif. Le TWR et le XIRR décrivent des performances passées : ce sont des indicateurs historiques, pas des prévisions ni une garantie de rendement futur. Cet outil ne constitue pas un conseil en investissement.',
        )}
      </Alert>
    </>
  )
}
