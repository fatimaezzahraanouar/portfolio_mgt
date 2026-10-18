import type { TaxSettings, TaxYearSummary, Transaction } from '../types'
import { realizedEventsOf } from './positions'

/**
 * Fiscalité marocaine — tous les taux sont PARAMÉTRABLES car ils changent
 * à chaque loi de finances (cf. Paramètres → Fiscalité).
 *
 *  - Plus-values réalisées sur titres (actions cotées / parts d'OPCVM) : TPCVM
 *  - Dividendes et coupons : retenue à la source
 */
export function summarizeTaxYear(
  transactions: Transaction[],
  settings: TaxSettings,
): TaxYearSummary[] {
  const events = realizedEventsOf(transactions)
  const byYear = new Map<number, TaxYearSummary>()

  const blank = (year: number): TaxYearSummary => ({
    year,
    realizedGains: 0,
    realizedLosses: 0,
    taxableGains: 0,
    capitalGainsTax: 0,
    grossDividends: 0,
    withheldDividends: 0,
    grossCoupons: 0,
    withheldCoupons: 0,
    totalTax: 0,
  })

  const ensure = (year: number) => {
    let s = byYear.get(year)
    if (!s) {
      s = blank(year)
      byYear.set(year, s)
    }
    return s
  }

  for (const ev of events) {
    const year = Number(ev.date.slice(0, 4))
    const s = ensure(year)
    if (ev.realizedPnl >= 0) s.realizedGains += ev.realizedPnl
    else s.realizedLosses += ev.realizedPnl
  }

  for (const tx of transactions) {
    if (tx.type !== 'DIVIDENDE' && tx.type !== 'COUPON') continue
    const year = Number(tx.date.slice(0, 4))
    const s = ensure(year)
    const gross = tx.amount ?? 0
    const withheld = tx.taxes ?? 0
    if (tx.type === 'DIVIDENDE') {
      s.grossDividends += gross
      s.withheldDividends += withheld
    } else {
      s.grossCoupons += gross
      s.withheldCoupons += withheld
    }
  }

  const rate = settings.capitalGainsRate / 100
  const divRate = settings.dividendWithholdingRate / 100

  const summaries = [...byYear.values()].sort((a, b) => a.year - b.year)
  for (const s of summaries) {
    const netGains = s.realizedGains + s.realizedLosses
    s.taxableGains = Math.max(0, netGains - settings.exemptionThreshold)
    s.capitalGainsTax = round2(s.taxableGains * rate)
    // Retenue déjà opérée à la source : on recalcule au taux courant
    s.withheldDividends = round2(s.grossDividends * divRate)
    s.withheldCoupons = round2(s.grossCoupons * divRate)
    s.totalTax = round2(s.capitalGainsTax + s.withheldDividends + s.withheldCoupons)
  }

  return summaries
}

export function summarizeYear(
  transactions: Transaction[],
  settings: TaxSettings,
  year: number,
): TaxYearSummary {
  const all = summarizeTaxYear(transactions, settings)
  return (
    all.find((s) => s.year === year) ?? {
      year,
      realizedGains: 0,
      realizedLosses: 0,
      taxableGains: 0,
      capitalGainsTax: 0,
      grossDividends: 0,
      withheldDividends: 0,
      grossCoupons: 0,
      withheldCoupons: 0,
      totalTax: 0,
    }
  )
}

/** Impôt estimé sur une plus-value réalisée (hors seuil d'exonération) */
export function capitalGainsTax(positiveGains: number, settings: TaxSettings): number {
  return round2(Math.max(0, positiveGains) * (settings.capitalGainsRate / 100))
}

/** Retenue à la source estimée sur un dividende brut */
export function dividendWithholding(gross: number, settings: TaxSettings): number {
  return round2(Math.max(0, gross) * (settings.dividendWithholdingRate / 100))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
