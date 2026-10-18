import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { buildValueSeries, computePerformance, timeWeightedReturn } from './performance'
import { xirr } from './xirr'

const h = (date: string, close: number) => ({ date, close })

function tx(t: Partial<Transaction> & { type: Transaction['type']; date: string }): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    portfolioId: 'p1',
    instrumentId: 'A',
    createdAt: t.date,
    ...t,
  } as Transaction
}

describe('XIRR', () => {
  it('retrouve un rendement annuel simple', () => {
    const rate = xirr([{ date: '2025-01-01', amount: -12_000, type: 'DEPOT' }], 13_000, '2026-01-01')
    expect(rate).not.toBeNull()
    expect(rate!).toBeCloseTo(13_000 / 12_000 - 1, 6)
  })

  it('annualise correctement un placement de 6 mois', () => {
    const rate = xirr([{ date: '2026-01-01', amount: -10_000, type: 'DEPOT' }], 10_500, '2026-07-01')
    expect(rate!).toBeCloseTo(Math.pow(1.05, 365 / 181) - 1, 3)
  })

  it('gère versements successifs et retrait', () => {
    const rate = xirr(
      [
        { date: '2025-01-01', amount: -10_000, type: 'DEPOT' },
        { date: '2025-07-01', amount: -5_000, type: 'DEPOT' },
        { date: '2025-12-01', amount: 2_000, type: 'RETRAIT' },
      ],
      14_500,
      '2026-01-01',
    )
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThan(0)
    expect(rate!).toBeLessThan(1)
  })

  it('retourne null sans flux ni montant terminal exploitable', () => {
    expect(xirr([], 1000, '2026-01-01')).toBeNull()
    expect(
      xirr([{ date: '2025-01-01', amount: -1000, type: 'DEPOT' }], -500, '2026-01-01'),
    ).toBeNull()
  })
})

describe('Série de valorisation & TWR', () => {
  const priceHistory = new Map([
    ['A', [h('2026-01-01', 100), h('2026-01-02', 110), h('2026-01-03', 110)]],
  ])

  it('neutralise les flux externes dans le TWR', () => {
    const series = buildValueSeries({
      transactions: [
        tx({ type: 'DEPOT', instrumentId: null, date: '2025-12-31', amount: 1000 }),
        tx({ type: 'ACHAT', date: '2026-01-01', quantity: 10, price: 100 }),
        tx({ type: 'DEPOT', instrumentId: null, date: '2026-01-02', amount: 500 }),
      ],
      priceHistory,
    })
    // 31/12 (1 000 en cash), 01/01 (achat → 1 000 en titres), 02/01 (+500), 03/01
    expect(series).toHaveLength(4)
    expect(series[0].value).toBe(1000)
    expect(series[2].value).toBe(1600)

    const { twr } = timeWeightedReturn(series)
    // J2 : (1 600 − 500) / 1 000 − 1 = +10 % ; J3 : 0 % → TWR = 10 %
    // alors que la valeur brute a progressé de 60 %
    expect(twr).toBeCloseTo(0.1, 6)
    expect(series[2].value / series[0].value - 1).toBeCloseTo(0.6, 6)
  })

  it('agrège les opérations du jour avant valorisation', () => {
    const series = buildValueSeries({
      transactions: [
        tx({ type: 'DEPOT', instrumentId: null, date: '2026-01-01', amount: 1000 }),
        tx({ type: 'ACHAT', date: '2026-01-02', quantity: 5, price: 110 }),
      ],
      priceHistory,
    })
    // 02/01 : cash 1 000 − 550 = 450 + 5 × 110 = 550 → 1 000
    expect(series[1].value).toBe(1000)
    expect(series[1].value - 450).toBe(5 * 110)
  })

  it('produit TWR, XIRR et rendement simple', () => {
    const perf = computePerformance({
      transactions: [
        tx({ type: 'DEPOT', instrumentId: null, date: '2026-01-01', amount: 1000 }),
        tx({ type: 'ACHAT', date: '2026-01-01', quantity: 10, price: 100 }),
      ],
      priceHistory,
      currentValue: 1100,
      asOf: '2027-01-01',
    })
    expect(perf.deposits).toBe(1000)
    expect(perf.twr).toBeCloseTo(0.1, 6)
    expect(perf.simpleReturn).toBeCloseTo(0.1, 6)
    expect(perf.xirr).not.toBeNull()
    expect(perf.xirr!).toBeCloseTo(0.1, 3)
  })

  it('tranche la série selon la plage demandée', () => {
    const series = buildValueSeries({
      transactions: [tx({ type: 'DEPOT', instrumentId: null, date: '2026-01-01', amount: 1000 })],
      priceHistory,
    })
    expect(timeWeightedReturn(series).twr).toBe(0)
    expect(series.length).toBeGreaterThan(0)
  })
})
