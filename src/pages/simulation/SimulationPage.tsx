import * as React from 'react'
import { CalendarClock, ShoppingCart } from 'lucide-react'
import { useI18n, useT } from '@/i18n'
import { useStore } from '@/state/store'
import type { Position } from '@/domain/types'
import { buildAllocation, buildSectorAllocation } from '@/domain/calc'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, PageHeader, SkeletonCards } from '@/components/shared/page'
import { MiniStat } from '@/components/shared/stat-card'
import { DonutChart, HBarList } from '@/components/shared/charts'
import { Money } from '@/components/shared/money'
import { DcaChart } from './DcaChart'
import { formatPct, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Valeur future d'un plan d'épargne (capitalisation mensuelle)        */
/* VF = M × ((1+i)^n − 1)/i, i = r/12, n = nombre de mois             */
/* ------------------------------------------------------------------ */

function futureValue(monthly: number, monthlyRate: number, months: number, atStart: boolean): number {
  const i = monthlyRate
  let fv: number
  if (Math.abs(i) < 1e-9) fv = monthly * months
  else fv = monthly * ((Math.pow(1 + i, months) - 1) / i)
  return atStart ? fv * (1 + i) : fv
}

function dcaSeries(monthly: number, annualRatePct: number, months: number, atStart: boolean) {
  const i = annualRatePct / 100 / 12
  const iMono = 0.035 / 12
  const start = new Date(`${todayISO()}T00:00:00Z`)
  const rows: Array<{ date: string; plan: number; monetaire: number }> = []
  for (let m = 1; m <= months; m++) {
    const date = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1),
    )
      .toISOString()
      .slice(0, 10)
    rows.push({
      date,
      plan: futureValue(monthly, i, m, atStart),
      monetaire: futureValue(monthly, iMono, m, atStart),
    })
  }
  return rows
}

/** Fusionne la ligne fictive d'achat dans les positions existantes */
function mergeFakePosition(positions: Position[], fake: Position): Position[] {
  const idx = positions.findIndex((p) => p.instrumentId === fake.instrumentId)
  if (idx === -1) return [...positions, fake]
  const copy = [...positions]
  const p = copy[idx]
  const quantity = p.quantity + fake.quantity
  const cost = p.cost + fake.cost
  const marketValue = p.marketValue + fake.marketValue
  copy[idx] = {
    ...p,
    quantity,
    cost,
    pru: quantity > 0 ? cost / quantity : 0,
    marketValue,
    unrealizedPnl: marketValue - cost,
    unrealizedPnlPct: cost > 0 ? ((marketValue - cost) / cost) * 100 : 0,
    invested: p.invested + fake.cost,
  }
  return copy
}

export default function SimulationPage() {
  const t = useT()
  const { locale } = useI18n()
  const { instruments, instrumentById, quoteById, snapshot, settings, loading } = useStore()

  /* ------------------- Simulateur « et si » : état ------------------- */

  const [instrumentId, setInstrumentId] = React.useState('')
  const [qty, setQty] = React.useState('10')
  const [price, setPrice] = React.useState('')
  const [date, setDate] = React.useState(todayISO())

  React.useEffect(() => {
    if (instrumentId || instruments.length === 0) return
    const first = instruments.find((i) => i.active) ?? instruments[0]
    setInstrumentId(first.id)
    const quote = quoteById.get(first.id)
    if (quote) setPrice(quote.close.toFixed(2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments, instrumentId])

  function onInstrumentChange(id: string) {
    setInstrumentId(id)
    const quote = quoteById.get(id)
    setPrice(quote ? quote.close.toFixed(2) : '')
  }

  const instrument = instrumentById.get(instrumentId)

  const quantity = Number(qty.replace(',', '.'))
  const unitPrice = Number(price.replace(',', '.'))
  const gross = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0
  const feePct = settings?.defaultFeePct ?? 0.5
  const feeMin = settings?.defaultFeeMin ?? 50
  const fees = gross > 0 ? Math.max((gross * feePct) / 100, feeMin) : 0
  const totalCost = gross + fees
  const validBuy = Boolean(instrument) && quantity > 0 && unitPrice > 0

  const sim = React.useMemo(() => {
    if (!snapshot || !instrument || !(quantity > 0) || !(unitPrice > 0)) return null
    const cashAfter = snapshot.cash.balance - totalCost
    const fake: Position = {
      portfolioId: snapshot.portfolioId,
      instrumentId: instrument.id,
      type: instrument.type,
      ticker: instrument.ticker,
      name: instrument.name,
      sector: instrument.sector,
      category: instrument.category,
      quantity,
      pru: quantity > 0 ? totalCost / quantity : 0,
      cost: totalCost,
      lastPrice: unitPrice,
      priceDate: date,
      marketValue: gross,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      dayChangePct: 0,
      weight: 0,
      realizedPnl: 0,
      income: 0,
      invested: totalCost,
    }
    const afterPositions = mergeFakePosition(snapshot.positions, fake)
    const afterTotal =
      afterPositions.reduce((s, p) => s + p.marketValue, 0) + cashAfter
    const beforeTotal = snapshot.totalValue > 0 ? snapshot.totalValue : 1

    const before = buildAllocation(snapshot.positions, snapshot.cash.balance)
    const after = buildAllocation(afterPositions, cashAfter)
    const sectors = buildSectorAllocation(afterPositions, afterTotal)

    const rows = afterPositions
      .map((ap) => {
        const beforePos = snapshot.positions.find((x) => x.instrumentId === ap.instrumentId)
        const beforeValue = beforePos?.marketValue ?? 0
        const beforeWeight = (beforeValue / beforeTotal) * 100
        const afterWeight = afterTotal > 0 ? (ap.marketValue / afterTotal) * 100 : 0
        return {
          instrumentId: ap.instrumentId,
          name: ap.name,
          ticker: ap.ticker,
          isNew: !beforePos,
          beforeValue,
          afterValue: ap.marketValue,
          beforeWeight,
          afterWeight,
          pru: ap.pru,
          beforePru: beforePos?.pru ?? 0,
          beforeCost: beforePos?.cost ?? 0,
          afterCost: ap.cost,
        }
      })
      .sort((a, b) => b.afterValue - a.afterValue)

    return {
      fake,
      cashAfter,
      afterTotal,
      beforeTotal: snapshot.totalValue,
      before,
      after,
      sectors,
      rows,
      concentrated: rows.filter((r) => r.afterWeight > 20),
    }
  }, [snapshot, instrument, quantity, unitPrice, totalCost, gross, date])

  /** Delta de poids par classe d'actifs (avant → après) */
  const classRows = React.useMemo(() => {
    if (!sim) return []
    const keys = new Set([...sim.before.map((s) => s.key), ...sim.after.map((s) => s.key)])
    return [...keys]
      .map((key) => {
        const b = sim.before.find((s) => s.key === key)
        const a = sim.after.find((s) => s.key === key)
        return {
          key,
          label: a?.label ?? b?.label ?? key,
          color: a?.color ?? b?.color ?? '#9aa1b2',
          value: a?.value ?? 0,
          beforeWeight: b?.weight ?? 0,
          afterWeight: a?.weight ?? 0,
          delta: (a?.weight ?? 0) - (b?.weight ?? 0),
        }
      })
      .sort((x, y) => y.afterWeight - x.afterWeight)
  }, [sim])

  /* --------------- Investissement programmé : état --------------- */

  const [monthly, setMonthly] = React.useState('1000')
  const [years, setYears] = React.useState('10')
  const [ratePct, setRatePct] = React.useState(6)
  const [timing, setTiming] = React.useState<'FIN' | 'DEBUT'>('FIN')

  const dca = React.useMemo(() => {
    const M = Number(monthly.replace(',', '.'))
    const Y = Number(years.replace(',', '.'))
    if (!(M > 0) || !(Y > 0) || !Number.isFinite(M) || !Number.isFinite(Y)) return null
    const months = Math.max(1, Math.min(600, Math.round(Y * 12)))
    const i = ratePct / 100 / 12
    const iMono = 0.035 / 12
    const atStart = timing === 'DEBUT'
    const plan = futureValue(M, i, months, atStart)
    const monetaire = futureValue(M, iMono, months, atStart)
    const contributed = M * months
    const series = dcaSeries(M, ratePct, months, atStart)
    return { months, contributed, plan, monetaire, series, interest: plan - contributed }
  }, [monthly, years, ratePct, timing])

  const actions = React.useMemo(
    () => instruments.filter((i) => i.type === 'ACTION' && i.active),
    [instruments],
  )
  const funds = React.useMemo(
    () => instruments.filter((i) => i.type === 'OPCVM' && i.active),
    [instruments],
  )

  /* -------------------------------- rendu -------------------------------- */

  return (
    <>
      <PageHeader
        title={t('sim.title', 'Simulation')}
        description={t(
          'sim.desc',
          'Visualisez l’impact d’un achat fictif ou de versements programmés sur votre portefeuille — sans rien enregistrer.',
        )}
      />

      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="space-y-6">
          {/* ==================== Simulateur « et si » ==================== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-brand-600" />
                {t('sim.whatIf', 'Simulateur « et si »')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="sim-instrument">{t('common.name', 'Instrument')}</Label>
                  <Select
                    id="sim-instrument"
                    value={instrumentId}
                    onChange={(e) => onInstrumentChange(e.target.value)}
                  >
                    <option value="">{t('sim.pickInstrument', 'Choisir…')}</option>
                    <optgroup label={t('sim.actionsGroup', 'Actions')}>
                      {actions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.ticker})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('sim.fundsGroup', 'OPCVM')}>
                      {funds.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.ticker})
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sim-qty">{t('common.quantity', 'Quantité')}</Label>
                  <Input
                    id="sim-qty"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="sim-price">
                    {instrument?.type === 'OPCVM'
                      ? t('sim.vl', 'VL indicative (MAD)')
                      : t('sim.price', 'Cours (MAD)')}
                  </Label>
                  <Input
                    id="sim-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="sim-date">{t('common.date', 'Date de l’opération')}</Label>
                  <Input
                    id="sim-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              {!snapshot ? (
                <EmptyState
                  title={t('sim.noPortfolio', 'Aucun portefeuille actif')}
                  description={t(
                    'sim.noPortfolioDesc',
                    'Créez d’abord un portefeuille et saisissez vos opérations pour simuler un achat.',
                  )}
                />
              ) : !validBuy ? (
                <Alert variant="info">
                  {t(
                    'sim.fillForm',
                    'Choisissez un instrument, une quantité et un prix pour visualiser l’impact de l’achat fictif sur votre répartition.',
                  )}
                </Alert>
              ) : sim ? (
                <>
                  {/* Coût de l'opération */}
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-anthracite-50/60 p-4 dark:bg-anthracite-900/40 lg:grid-cols-4">
                    <MiniStat label={t('sim.gross', 'Montant brut')}>
                      <Money value={gross} />
                    </MiniStat>
                    <MiniStat
                      label={t('sim.fees', 'Frais estimés')}
                    >
                      <Money value={fees} />
                      <span className="ms-1 text-[11px] font-normal text-muted">
                        ({formatPct(feePct, { locale, decimals: 2, sign: false })}{' '}
                        {t('sim.feesMin', 'min.')} <Money value={feeMin} decimals={0} />)
                      </span>
                    </MiniStat>
                    <MiniStat label={t('sim.totalCost', 'Coût total')}>
                      <Money value={totalCost} className="text-ink" />
                    </MiniStat>
                    <MiniStat label={t('sim.cashAfter', 'Trésorerie après l’achat')}>
                      <Money
                        value={sim.cashAfter}
                        className={cn(sim.cashAfter < 0 && 'text-loss-600 dark:text-loss-500')}
                      />
                    </MiniStat>
                  </div>

                  {/* Alertes */}
                  {sim.cashAfter < 0 ? (
                    <Alert variant="danger" title={t('sim.negativeCash', 'Trésorerie insuffisante')}>
                      {t(
                        'sim.negativeCashDesc',
                        'Cet achat fictif rendrait votre trésorerie négative. Envisagez un montant plus faible ou un dépôt préalable.',
                      )}
                    </Alert>
                  ) : null}
                  {sim.concentrated.length > 0 ? (
                    <Alert
                      variant="warning"
                      title={t('sim.concentration', 'Concentration au-delà de 20 %')}
                    >
                      <ul className="space-y-0.5">
                        {sim.concentrated.map((r) => (
                          <li key={r.instrumentId}>
                            <span className="font-semibold">{r.name}</span> —{' '}
                            {t('sim.weightAfter', 'poids après achat')} :{' '}
                            {formatPct(r.afterWeight, { locale, decimals: 1, sign: false })}
                            {r.beforeWeight <= 20 ? ` (${t('sim.crossed', 'seuil franchi')})` : ''}
                          </li>
                        ))}
                      </ul>
                    </Alert>
                  ) : null}

                  {/* Répartition avant / après */}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-ink">
                      {t('sim.impact', 'Impact sur la répartition')}
                    </h4>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <DonutChart
                        slices={sim.after}
                        height={220}
                        centerLabel={t('sim.afterBuy', 'Après achat fictif')}
                        centerValue={<Money value={sim.afterTotal} decimals={0} hideMaskable />}
                      />
                      <ul className="space-y-1.5">
                        {classRows.map((r) => (
                          <li key={r.key} className="flex items-center gap-2 text-sm">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: r.color }}
                            />
                            <span className="min-w-0 flex-1 truncate text-anthracite-600 dark:text-anthracite-300">
                              {r.label}
                            </span>
                            <span className="tabular text-xs text-muted">
                              {formatPct(r.beforeWeight, { locale, decimals: 1, sign: false })}
                            </span>
                            <span className="text-anthracite-400">→</span>
                            <span className="tabular text-xs font-semibold text-ink">
                              {formatPct(r.afterWeight, { locale, decimals: 1, sign: false })}
                            </span>
                            <Badge
                              variant={
                                r.delta > 0.05
                                  ? 'default'
                                  : r.delta < -0.05
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="w-16 justify-center"
                            >
                              {formatPct(r.delta, { locale, decimals: 1 })}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Tableau avant / après */}
                  <Table className="min-w-[680px]">
                    <THead>
                      <TR>
                        <TH>{t('common.name', 'Ligne')}</TH>
                        <TH align="end">{t('sim.valueBA', 'Valeur (avant → après)')}</TH>
                        <TH align="end">{t('sim.weightBA', 'Poids (avant → après)')}</TH>
                        <TH align="end">{t('sim.pruBA', 'PRU (avant → après)')}</TH>
                        <TH align="end">{t('sim.costBA', 'Coût total (avant → après)')}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {sim.rows.map((r) => (
                        <TR key={r.instrumentId} className={r.isNew ? 'bg-brand-50/50 dark:bg-brand-950/30' : undefined}>
                          <TD>
                            <span className="font-semibold text-ink">{r.name}</span>
                            <span className="ms-1.5 text-[11px] text-muted">{r.ticker}</span>
                            {r.isNew ? (
                              <Badge variant="default" className="ms-2">
                                {t('sim.fictitious', 'Fictive')}
                              </Badge>
                            ) : null}
                          </TD>
                          <TD align="end">
                            <span className="block text-xs text-anthracite-500">
                              <Money value={r.beforeValue} decimals={0} hideMaskable />
                            </span>
                            <span className="block font-semibold">
                              <Money value={r.afterValue} decimals={0} hideMaskable />
                            </span>
                          </TD>
                          <TD align="end">
                            <span className="block text-xs text-anthracite-500">
                              {formatPct(r.beforeWeight, { locale, decimals: 1, sign: false })}
                            </span>
                            <span
                              className={cn(
                                'block font-semibold',
                                r.afterWeight > 20 && 'text-amber-700 dark:text-amber-400',
                              )}
                            >
                              {formatPct(r.afterWeight, { locale, decimals: 1, sign: false })}
                            </span>
                          </TD>
                          <TD align="end">
                            <span className="block text-xs text-anthracite-500">
                              <Money value={r.beforePru} decimals={2} hideMaskable />
                            </span>
                            <span className="block font-semibold">
                              <Money value={r.pru} decimals={2} hideMaskable />
                            </span>
                          </TD>
                          <TD align="end">
                            <span className="block text-xs text-anthracite-500">
                              <Money value={r.beforeCost} decimals={0} hideMaskable />
                            </span>
                            <span className="block font-semibold">
                              <Money value={r.afterCost} decimals={0} hideMaskable />
                            </span>
                          </TD>
                        </TR>
                      ))}
                      <TR className="bg-anthracite-50/70 dark:bg-anthracite-900/50">
                        <TD className="font-semibold">{t('sim.cash', 'Trésorerie')}</TD>
                        <TD align="end">
                          <span className="block text-xs text-anthracite-500">
                            <Money value={snapshot.cash.balance} decimals={0} hideMaskable />
                          </span>
                          <span
                            className={cn(
                              'block font-semibold',
                              sim.cashAfter < 0 && 'text-loss-600 dark:text-loss-500',
                            )}
                          >
                            <Money value={sim.cashAfter} decimals={0} hideMaskable />
                          </span>
                        </TD>
                        <TD align="end">—</TD>
                        <TD align="end">—</TD>
                        <TD align="end">—</TD>
                      </TR>
                      <TR className="bg-anthracite-50/70 dark:bg-anthracite-900/50">
                        <TD className="font-semibold">{t('common.total', 'Total portefeuille')}</TD>
                        <TD align="end">
                          <span className="block text-xs text-anthracite-500">
                            <Money value={sim.beforeTotal} decimals={0} hideMaskable />
                          </span>
                          <span className="block font-semibold">
                            <Money value={sim.afterTotal} decimals={0} hideMaskable />
                          </span>
                        </TD>
                        <TD align="end">—</TD>
                        <TD align="end">—</TD>
                        <TD align="end">—</TD>
                      </TR>
                    </TBody>
                  </Table>

                  {/* Secteurs après achat fictif */}
                  {sim.sectors.length > 0 ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-ink">
                        {t('sim.sectorsAfter', 'Répartition par secteur (après achat fictif)')}
                      </h4>
                      <HBarList
                        unit="%"
                        height={Math.max(140, sim.sectors.length * 34)}
                        rows={sim.sectors.map((s) => ({
                          key: s.key,
                          label: s.label,
                          value: s.weight,
                          color: s.color,
                        }))}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* ==================== Investissement programmé ==================== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-anthracite-500" />
                {t('sim.programmed', 'Investissement programmé')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="dca-monthly">{t('sim.monthly', 'Versement mensuel (MAD)')}</Label>
                  <Input
                    id="dca-monthly"
                    inputMode="decimal"
                    value={monthly}
                    onChange={(e) => setMonthly(e.target.value)}
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="dca-years">{t('sim.horizon', 'Horizon (années)')}</Label>
                  <Input
                    id="dca-years"
                    inputMode="numeric"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    min={1}
                    max={50}
                  />
                </div>
                <div>
                  <Label htmlFor="dca-rate">
                    {t('sim.rate', 'Rendement annuel attendu')} —{' '}
                    <span className="font-semibold tabular text-ink">
                      {formatPct(ratePct, { locale, decimals: 1, sign: false })}
                    </span>
                  </Label>
                  <input
                    id="dca-rate"
                    type="range"
                    min={0}
                    max={15}
                    step={0.5}
                    value={ratePct}
                    onChange={(e) => setRatePct(Number(e.target.value))}
                    aria-label={t('sim.rate', 'Rendement annuel attendu')}
                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-anthracite-200 accent-[#d13c18] dark:bg-anthracite-800"
                  />
                </div>
                <div>
                  <Label htmlFor="dca-timing">{t('sim.timing', 'Moment du versement')}</Label>
                  <Select
                    id="dca-timing"
                    value={timing}
                    onChange={(e) => setTiming(e.target.value === 'DEBUT' ? 'DEBUT' : 'FIN')}
                  >
                    <option value="FIN">{t('sim.timingEnd', 'En fin de mois')}</option>
                    <option value="DEBUT">{t('sim.timingStart', 'En début de mois')}</option>
                  </Select>
                </div>
              </div>

              {dca ? (
                <>
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-anthracite-50/60 p-4 dark:bg-anthracite-900/40 lg:grid-cols-4">
                    <MiniStat label={t('sim.contributed', 'Total versé')}>
                      <Money value={dca.contributed} />
                    </MiniStat>
                    <MiniStat label={t('sim.interest', 'Intérêts générés')}>
                      <Money value={dca.interest} className="text-gain-600 dark:text-gain-500" />
                    </MiniStat>
                    <MiniStat label={t('sim.finalValue', 'Valeur estimée à l’horizon')}>
                      <Money value={dca.plan} className="text-xl font-bold text-ink" />
                    </MiniStat>
                    <MiniStat label={t('sim.monoCompare', 'Fonds monétaire à 3,5 %')}>
                      <Money value={dca.monetaire} />
                      <span className="ms-1 text-[11px] font-normal text-muted">
                        ({formatPct(ratePct - 3.5, { locale, decimals: 1 })}{' '}
                        {t('sim.vsPlan', 'vs plan')})
                      </span>
                    </MiniStat>
                  </div>

                  <DcaChart data={dca.series} />
                </>
              ) : (
                <Alert variant="info">
                  {t(
                    'sim.fillDca',
                    'Renseignez un versement mensuel et une horizon pour projeter votre plan d’épargne.',
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted">
            {t(
              'sim.disclaimer',
              'Simulation indicative, aucun engagement : les performances passées ne préjugent pas des performances futures.',
            )}
          </p>
        </div>
      )}
    </>
  )
}
