import type { RiskMetrics } from '../types'
import type { ValuePoint } from './performance'

const TRADING_DAYS = 252

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Volatilité annualisée à partir des rendements journaliers */
export function annualizedVolatility(dailyReturns: number[]): number {
  return standardDeviation(dailyReturns) * Math.sqrt(TRADING_DAYS)
}

/** Drawdown maximal : creux le plus profond par rapport au plus haut */
export function maxDrawdown(equityCurve: number[]): number {
  let peak = -Infinity
  let maxDd = 0
  for (const v of equityCurve) {
    if (v > peak) peak = v
    if (peak > 0) {
      const dd = v / peak - 1
      if (dd < maxDd) maxDd = dd
    }
  }
  return maxDd
}

export interface DrawdownPoint {
  date: string
  drawdown: number
}

export function drawdownSeries(equityCurve: ValuePoint[]): DrawdownPoint[] {
  let peak = -Infinity
  return equityCurve.map((p) => {
    if (p.value > peak) peak = p.value
    const dd = peak > 0 && isFinite(peak) ? p.value / peak - 1 : 0
    return { date: p.date, drawdown: dd * 100 }
  })
}

export interface RiskInput {
  series: ValuePoint[]
  weights: Array<{ instrumentId: string; name: string; weight: number }>
  /** Seuil de concentration (%) */
  concentrationThreshold?: number
}

export function computeRisk(input: RiskInput): RiskMetrics {
  const { series, weights, concentrationThreshold = 20 } = input
  const returns = series.slice(1).map((p) => p.dailyReturn).filter((r) => isFinite(r))
  const equity = series.map((p) => p.value * (1 + p.twrPct / 100))

  const concentration = [...weights]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((w) => ({ ...w, weight: Math.round(w.weight * 100) / 100 }))
  const maxConcentration = concentration[0]?.weight ?? 0

  return {
    volatility: annualizedVolatility(returns),
    maxDrawdown: maxDrawdown(equity),
    worstDay: returns.length ? Math.min(...returns) : 0,
    bestDay: returns.length ? Math.max(...returns) : 0,
    concentration,
    maxConcentration,
    isConcentrated: maxConcentration > concentrationThreshold,
  }
}

/** Ratio de Sharpe simplifié (taux sans risque paramétrable, défaut 3 % MAROC) */
export function sharpeRatio(returns: number[], riskFreeAnnual = 0.03): number {
  const vol = annualizedVolatility(returns)
  if (vol === 0) return 0
  const avgAnnual = mean(returns) * TRADING_DAYS
  return (avgAnnual - riskFreeAnnual) / vol
}
