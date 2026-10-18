import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { capitalGainsTax, dividendWithholding, summarizeTaxYear, summarizeYear } from './tax'
import { annualizedVolatility, computeRisk, maxDrawdown, sharpeRatio } from './risk'
import type { ValuePoint } from './performance'

const settings = {
  capitalGainsRate: 10,
  dividendWithholdingRate: 15,
  exemptionThreshold: 0,
  fiscalYear: 2026,
}

function tx(t: Partial<Transaction> & { type: Transaction['type']; date: string }): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    portfolioId: 'p1',
    instrumentId: 'A',
    createdAt: t.date,
    ...t,
  } as Transaction
}

describe('Fiscalité', () => {
  const transactions: Transaction[] = [
    tx({ type: 'ACHAT', date: '2025-02-01', quantity: 100, price: 100 }),
    tx({ type: 'VENTE', date: '2025-06-01', quantity: 100, price: 150, fees: 50, taxes: 10 }),
    tx({ type: 'ACHAT', date: '2025-07-01', quantity: 100, price: 150 }),
    tx({ type: 'VENTE', date: '2026-03-01', quantity: 100, price: 140, fees: 50, taxes: 10 }),
    tx({ type: 'DIVIDENDE', date: '2026-04-10', amount: 1200, taxes: 180 }),
    tx({ type: 'COUPON', date: '2026-05-10', amount: 300, taxes: 45 }),
  ]

  it('calcule les plus-values réalisées année par année', () => {
    const rows = summarizeTaxYear(transactions, settings)
    const y2025 = rows.find((r) => r.year === 2025)!
    const y2026 = rows.find((r) => r.year === 2026)!
    // 2025 : (150−100)×100 − 50 − 10 = 4 940
    expect(y2025.realizedGains).toBeCloseTo(4940, 6)
    expect(y2025.capitalGainsTax).toBeCloseTo(494, 2)
    // 2026 : (140−150)×100 − 50 − 10 = −1 060 → pas d'impôt
    expect(y2026.realizedLosses).toBeCloseTo(-1060, 6)
    expect(y2026.taxableGains).toBe(0)
    expect(y2026.capitalGainsTax).toBe(0)
  })

  it('applique la retenue à la source aux dividendes et coupons', () => {
    const y2026 = summarizeYear(transactions, settings, 2026)
    expect(y2026.grossDividends).toBe(1200)
    expect(y2026.withheldDividends).toBeCloseTo(180, 2)
    expect(y2026.grossCoupons).toBe(300)
    expect(y2026.withheldCoupons).toBeCloseTo(45, 2)
    expect(y2026.totalTax).toBeCloseTo(180 + 45, 2)
  })

  it('tient compte du seuil d’exonération', () => {
    const rows = summarizeTaxYear(transactions, { ...settings, exemptionThreshold: 5000 })
    const y2025 = rows.find((r) => r.year === 2025)!
    expect(y2025.taxableGains).toBe(0)
    expect(y2025.capitalGainsTax).toBe(0)
  })

  it('calcule l’impôt estimé sur une plus-value et la retenue dividende', () => {
    expect(capitalGainsTax(10_000, settings)).toBe(1000)
    expect(capitalGainsTax(-500, settings)).toBe(0)
    expect(dividendWithholding(5_000, settings)).toBe(750)
  })
})

describe('Risque', () => {
  const mk = (values: number[]): ValuePoint[] =>
    values.map((value, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      value,
      flow: 0,
      dailyReturn: i === 0 ? 0 : value / values[i - 1] - 1,
      twrPct: (value / values[0] - 1) * 100,
    }))

  it('mesure le drawdown maximal', () => {
    expect(maxDrawdown([100, 120, 90, 130, 65])).toBeCloseTo(65 / 130 - 1, 6)
    expect(maxDrawdown([100, 110, 120])).toBe(0)
    expect(maxDrawdown([])).toBe(0)
  })

  it('annualise la volatilité', () => {
    const vol = annualizedVolatility([0.01, -0.01, 0.01, -0.01])
    expect(vol).toBeGreaterThan(0)
    expect(annualizedVolatility([0.01])).toBe(0)
  })

  it('détecte la concentration au-delà de 20 %', () => {
    const risk = computeRisk({
      series: mk([100, 101, 99, 102]),
      weights: [
        { instrumentId: 'A', name: 'Attijariwafa Bank', weight: 35 },
        { instrumentId: 'B', name: 'IAM', weight: 20 },
        { instrumentId: 'C', name: 'Managem', weight: 10 },
      ],
    })
    expect(risk.isConcentrated).toBe(true)
    expect(risk.maxConcentration).toBe(35)
    expect(risk.concentration[0].instrumentId).toBe('A')
    expect(risk.maxDrawdown).toBeLessThan(0)
  })

  it('calcule un ratio de Sharpe', () => {
    const s = sharpeRatio([0.001, -0.0005, 0.0008, 0.0002])
    expect(Number.isFinite(s)).toBe(true)
  })
})
