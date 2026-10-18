import type { FlowType, PricePoint, RangeKey, Transaction } from '../types'
import { extractFlows, xirr, type CashFlow } from './xirr'

const EPS = 1e-9
const DAY = 86_400_000

export interface ValuePoint {
  date: string
  /** Valeur totale du portefeuille (titres + liquidités) en MAD */
  value: number
  /** Flux externes nets de cette journée */
  flow: number
  /** Rendement journalier hors flux (TWR) */
  dailyReturn: number
  /** Rendement TWR cumulé depuis le début de la fenêtre */
  twrPct: number
}

export interface SeriesInputs {
  transactions: Transaction[]
  /** Historique de cours par instrument (trié croissant) */
  priceHistory: Map<string, PricePoint[]>
  from?: string
  to?: string
}

/**
 * Construit la série de valorisation jour par jour du portefeuille.
 * Les cours manquants sont « forward / backward filled » avec la dernière
 * valeur connue (les données de démonstration sont différées).
 */
export function buildValueSeries(inputs: SeriesInputs): ValuePoint[] {
  const { transactions, priceHistory, from, to } = inputs

  const txs = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  // Calendrier = union des dates de cotation et des opérations
  const dateSet = new Set<string>()
  for (const pts of priceHistory.values()) for (const p of pts) dateSet.add(p.date)
  for (const tx of txs) dateSet.add(tx.date)
  let dates = [...dateSet].sort()
  if (from) dates = dates.filter((d) => d >= from)
  if (to) dates = dates.filter((d) => d <= to)
  if (dates.length === 0) return []

  const qty = new Map<string, number>()
  let cash = 0
  let txIdx = 0

  // Pointeurs par instrument dans l'historique
  const ptr = new Map<string, number>()
  const lastKnown = new Map<string, number>()
  for (const [id, pts] of priceHistory) {
    ptr.set(id, 0)
    // prix déjà connu avant la première date retenue
    const firstDate = dates[0]
    let i = 0
    while (i < pts.length && pts[i].date < firstDate) {
      lastKnown.set(id, pts[i].close)
      i++
    }
    ptr.set(id, i)
  }

  const series: ValuePoint[] = []
  let cumTwr = 1

  for (const date of dates) {
    // 1. opérations du jour
    let dayFlow = 0
    while (txIdx < txs.length && txs[txIdx].date <= date) {
      const tx = txs[txIdx]
      const fees = tx.fees ?? 0
      const taxes = tx.taxes ?? 0
      const q = tx.quantity ?? 0
      const price = tx.price ?? 0
      switch (tx.type) {
        case 'ACHAT':
        case 'SOUSCRIPTION':
        case 'AUGMENTATION_CAPITAL':
          if (tx.instrumentId) qty.set(tx.instrumentId, (qty.get(tx.instrumentId) ?? 0) + q)
          cash -= q * price + fees + taxes
          break
        case 'VENTE':
        case 'RACHAT':
          if (tx.instrumentId) qty.set(tx.instrumentId, (qty.get(tx.instrumentId) ?? 0) - q)
          cash += q * price - fees - taxes
          break
        case 'DIVIDENDE':
        case 'COUPON':
          cash += (tx.amount ?? 0) - taxes
          break
        case 'DEPOT':
          cash += tx.amount ?? 0
          dayFlow += tx.amount ?? 0
          break
        case 'RETRAIT':
          cash -= tx.amount ?? 0
          dayFlow -= tx.amount ?? 0
          break
        case 'FRAIS':
          cash -= tx.amount ?? 0
          break
        case 'SPLIT':
          if (tx.instrumentId && q > 0)
            qty.set(tx.instrumentId, (qty.get(tx.instrumentId) ?? 0) * q)
          break
        case 'ATTRIBUTION_GRATUITE':
          if (tx.instrumentId) qty.set(tx.instrumentId, (qty.get(tx.instrumentId) ?? 0) + q)
          break
      }
      txIdx++
    }

    // 2. valorisation
    let value = cash
    for (const [id, quantity] of qty) {
      if (Math.abs(quantity) < EPS) continue
      const pts = priceHistory.get(id)
      if (!pts || pts.length === 0) continue
      let i = ptr.get(id) ?? 0
      while (i < pts.length && pts[i].date <= date) {
        lastKnown.set(id, pts[i].close)
        i++
      }
      ptr.set(id, i)
      const p = lastKnown.get(id) ?? pts[0].close
      value += p * quantity
    }

    const prev = series[series.length - 1]
    let dailyReturn = 0
    if (prev && prev.value > EPS) {
      dailyReturn = (value - dayFlow) / prev.value - 1
      if (dailyReturn < -1) dailyReturn = -1
      cumTwr *= 1 + dailyReturn
    }
    series.push({
      date,
      value,
      flow: dayFlow,
      dailyReturn,
      twrPct: (cumTwr - 1) * 100,
    })
  }

  return series
}

export function sliceRange(series: ValuePoint[], range: RangeKey, toDate?: string): ValuePoint[] {
  if (series.length === 0) return series
  const end = toDate ?? series[series.length - 1].date
  const endMs = Date.parse(end)
  const spanDays: Record<RangeKey, number> = {
    '1J': 1,
    '1S': 7,
    '1M': 30,
    '3M': 91,
    '6M': 182,
    '1A': 365,
    MAX: 100_000,
  }
  const limit = new Date(endMs - spanDays[range] * DAY).toISOString().slice(0, 10)
  const filtered = series.filter((p) => p.date >= limit)
  return filtered.length >= 2 ? filtered : series.slice(-2)
}

export interface TWRResult {
  /** Rendement TWR sur la période (ex: 0.0842 = 8,42 %) */
  twr: number
  /** Rendement annualisé */
  annualized: number | null
  points: ValuePoint[]
}

/** Rendement pondéré par la durée (méthode géométrique des sous-périodes) */
export function timeWeightedReturn(points: ValuePoint[]): TWRResult {
  if (points.length === 0) return { twr: 0, annualized: null, points: [] }
  const start = points[0]
  const end = points[points.length - 1]
  let product = 1
  for (let i = 1; i < points.length; i++) {
    product *= 1 + points[i].dailyReturn
  }
  const twr = product - 1
  const days = Math.max(1, (Date.parse(end.date) - Date.parse(start.date)) / DAY)
  const annualized = days > 30 ? Math.pow(1 + twr, 365 / days) - 1 : null
  return { twr, annualized, points }
}

export interface PerformanceInputs {
  transactions: Transaction[]
  priceHistory: Map<string, PricePoint[]>
  /** Valeur actuelle (titres + liquidités) */
  currentValue: number
  from?: string
  to?: string
  /** Date de valorisation (AAAA-MM-JJ) */
  asOf: string
}

export interface PerformanceResult {
  twr: number
  annualized: number | null
  xirr: number | null
  /** Rendement simple = gain net / versements cumulés */
  simpleReturn: number
  series: ValuePoint[]
  flows: CashFlow[]
  deposits: number
  withdrawals: number
}

export function computePerformance(inputs: PerformanceInputs): PerformanceResult {
  const series = buildValueSeries({
    transactions: inputs.transactions,
    priceHistory: inputs.priceHistory,
    from: inputs.from,
    to: inputs.to,
  })
  const { twr, annualized } = timeWeightedReturn(series)

  const allFlows = extractFlows(inputs.transactions)
  const flows =
    inputs.from || inputs.to
      ? allFlows.filter(
          (f) => (!inputs.from || f.date >= inputs.from) && (!inputs.to || f.date <= inputs.to),
        )
      : allFlows

  const deposits = allFlows.filter((f) => f.amount < 0).reduce((s, f) => s - f.amount, 0)
  const withdrawals = allFlows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0)

  const rate = xirr(flows, inputs.currentValue, inputs.asOf)
  const simpleReturn = deposits > EPS ? (inputs.currentValue + withdrawals - deposits) / deposits : 0

  return { twr, annualized, xirr: rate, simpleReturn, series, flows, deposits, withdrawals }
}

/** Série d'un indice rebaseée en % sur la fenêtre (pour la comparaison MASI) */
export function rebase(indexSeries: PricePoint[], dates: string[]): Array<{ date: string; pct: number }> {
  if (indexSeries.length === 0) return []
  const map = new Map(indexSeries.map((p) => [p.date, p.close]))
  let base: number | null = null
  const out: Array<{ date: string; pct: number }> = []
  let last = indexSeries[0].close
  for (const d of dates) {
    const v = map.get(d)
    if (v !== undefined) last = v
    else {
      const before = [...indexSeries].reverse().find((p) => p.date <= d)
      if (before) last = before.close
    }
    if (base === null) base = last
    out.push({ date: d, pct: base > 0 ? ((last / base) - 1) * 100 : 0 })
  }
  return out
}

export const FLOW_TYPES: FlowType[] = ['DEPOT', 'RETRAIT']
