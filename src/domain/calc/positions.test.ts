import { describe, expect, it } from 'vitest'
import type { Instrument, Quote, Transaction } from '../types'
import { buildSnapshot, realizedEventsOf, unrealizedPnl, weightedAverageCost } from './positions'

const instruments = new Map<string, Instrument>([
  [
    'ATW',
    {
      id: 'ATW',
      type: 'ACTION',
      ticker: 'ATW',
      name: 'Attijariwafa Bank',
      sector: 'Banques',
      currency: 'MAD',
      active: true,
    },
  ],
  [
    'MIFA',
    {
      id: 'MIFA',
      type: 'OPCVM',
      ticker: 'MA0000012345',
      name: 'Fonds Monétaire Démo',
      currency: 'MAD',
      category: 'MONETAIRE',
      active: true,
    },
  ],
])

const quotes = new Map<string, Quote>([
  ['ATW', { instrumentId: 'ATW', date: '2026-10-16', close: 120, changePct: 1.69 }],
])

function tx(t: Partial<Transaction> & { type: Transaction['type']; date: string }): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    portfolioId: 'p1',
    instrumentId: 'ATW',
    createdAt: t.date,
    ...t,
  } as Transaction
}

describe('PRU — coût moyen pondéré', () => {
  it('intègre frais et taxes au prix de revient', () => {
    expect(weightedAverageCost(10_010, 100)).toBeCloseTo(100.1, 6)
    expect(weightedAverageCost(0, 0)).toBe(0)
  })

  it('recalcule le PRU après un second achat', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 10 }),
        tx({ type: 'ACHAT', date: '2026-03-05', quantity: 100, price: 110, fees: 10 }),
      ],
      instruments,
      quotes,
    })
    expect(snap.positions[0].quantity).toBe(200)
    expect(snap.positions[0].cost).toBeCloseTo(21_020, 6)
    expect(snap.positions[0].pru).toBeCloseTo(105.1, 6)
    expect(snap.cash.balance).toBeCloseTo(-21_020, 6)
  })

  it('divise le PRU par le ratio lors d’un split', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 0 }),
        tx({ type: 'SPLIT', date: '2026-02-05', quantity: 2 }),
      ],
      instruments,
      quotes,
    })
    expect(snap.positions[0].quantity).toBe(200)
    expect(snap.positions[0].pru).toBeCloseTo(50, 6)
  })

  it('baisse le PRU lors d’une attribution gratuite', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 0 }),
        tx({ type: 'ATTRIBUTION_GRATUITE', date: '2026-06-05', quantity: 20 }),
      ],
      instruments,
      quotes,
    })
    expect(snap.positions[0].quantity).toBe(120)
    expect(snap.positions[0].cost).toBeCloseTo(10_000, 6)
    expect(snap.positions[0].pru).toBeCloseTo(83.333333, 4)
  })
})

describe('Plus-values', () => {
  it('calcule la plus-value latente', () => {
    expect(unrealizedPnl(120, 105.1, 150)).toBeCloseTo(2235, 6)
  })

  it('réalise la plus-value à la vente et réduit le coût résiduel', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 10 }),
        tx({ type: 'ACHAT', date: '2026-03-05', quantity: 100, price: 110, fees: 10 }),
        tx({ type: 'VENTE', date: '2026-05-05', quantity: 50, price: 120, fees: 10, taxes: 5 }),
      ],
      instruments,
      quotes,
    })
    const p = snap.positions[0]
    // PRU 105,1 → coût sorti 5 255 ; produits nets 5 985 → +730
    expect(snap.realizedPnl).toBeCloseTo(730, 6)
    expect(p.quantity).toBe(150)
    expect(p.pru).toBeCloseTo(105.1, 6)
    expect(snap.cash.balance).toBeCloseTo(-21_020 + 5_985, 6)
    expect(snap.holdingsValue).toBeCloseTo(150 * 120, 6)
    expect(snap.unrealizedPnl).toBeCloseTo(150 * 120 - p.cost, 6)
  })

  it('clôt la ligne quand tout est vendu', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 0 }),
        tx({ type: 'VENTE', date: '2026-05-05', quantity: 100, price: 90, fees: 0 }),
      ],
      instruments,
      quotes,
    })
    expect(snap.positions).toHaveLength(0)
    expect(snap.realizedPnl).toBeCloseTo(-1000, 6)
    expect(snap.cash.balance).toBeCloseTo(-10_000 + 9_000, 6)
  })

  it('renvoie un événement par vente', () => {
    const events = realizedEventsOf([
      tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 0 }),
      tx({ type: 'VENTE', date: '2026-05-05', quantity: 40, price: 120, fees: 0, taxes: 20 }),
    ])
    expect(events).toHaveLength(1)
    expect(events[0].realizedPnl).toBeCloseTo(40 * 120 - 20 - 40 * 100, 6)
  })
})

describe('Trésorerie', () => {
  it('additionne dépôts, retraits, frais, dividendes et coupons nets', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'DEPOT', instrumentId: null, date: '2026-01-01', amount: 100_000 }),
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 25 }),
        tx({ type: 'DIVIDENDE', date: '2026-04-10', amount: 1000, taxes: 150 }),
        tx({ type: 'COUPON', instrumentId: 'MIFA', date: '2026-06-10', amount: 300, taxes: 45 }),
        tx({ type: 'FRAIS', instrumentId: null, date: '2026-07-01', amount: 120 }),
        tx({ type: 'RETRAIT', instrumentId: null, date: '2026-08-01', amount: 5_000 }),
      ],
      instruments,
      quotes,
    })
    expect(snap.cash.deposits).toBe(100_000)
    expect(snap.cash.withdrawals).toBe(5_000)
    expect(snap.cash.fees).toBe(145)
    expect(snap.cash.income).toBe(1_105)
    expect(snap.cash.balance).toBeCloseTo(100_000 - 10_025 + 850 + 255 - 120 - 5_000, 6)
    expect(snap.invested).toBe(10_025)
  })

  it('attribue les poids en % du total du portefeuille', () => {
    const snap = buildSnapshot({
      portfolioId: 'p1',
      transactions: [
        tx({ type: 'ACHAT', date: '2026-01-05', quantity: 100, price: 100, fees: 0 }),
        tx({ type: 'DEPOT', instrumentId: null, date: '2026-01-01', amount: 10_000 }),
      ],
      instruments,
      quotes,
    })
    // 10 000 de titres pour 10 000 déposés mais le dépôt est d'abord dépensé :
    // ici cash = 0 → total = 12 000 (cours 120)
    expect(snap.totalValue).toBeCloseTo(12_000, 6)
    expect(snap.positions[0].weight).toBeCloseTo(100, 4)
    expect(snap.dayChangePct).toBeCloseTo(1.69, 3)
  })
})
