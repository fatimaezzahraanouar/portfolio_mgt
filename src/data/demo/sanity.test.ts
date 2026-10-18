import { describe, expect, it } from 'vitest'
import { buildSnapshot } from '@/domain/calc/positions'
import { ALL_INSTRUMENTS } from './instruments'
import { allActionQuotes, quoteOfFund } from './market'
import { SEED_PORTFOLIOS, SEED_TRANSACTIONS } from './transactions'

const instruments = new Map(ALL_INSTRUMENTS.map((i) => [i.id, i]))
const quotes = new Map([
  ...allActionQuotes().map((q) => [q.instrumentId, q] as const),
  ...ALL_INSTRUMENTS.filter((i) => i.type === 'OPCVM')
    .map((i) => quoteOfFund(i.id))
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .map((q) => [q.instrumentId, q] as const),
])

describe('Jeu de données de démonstration', () => {
  it.each(SEED_PORTFOLIOS)('produit un portefeuille cohérent : %s', (portfolio) => {
    const snap = buildSnapshot({
      portfolioId: portfolio.id,
      transactions: SEED_TRANSACTIONS.filter((t) => t.portfolioId === portfolio.id),
      instruments,
      quotes,
    })
    expect(snap.positions.length).toBeGreaterThan(0)
    expect(snap.cash.balance).toBeGreaterThan(0)
    expect(snap.totalValue).toBeGreaterThan(snap.cash.balance)
    // les poids somment à 100 % (titres) + liquidités
    const sumWeights = snap.positions.reduce((s, p) => s + p.weight, 0)
    expect(sumWeights).toBeLessThanOrEqual(100.01)
    expect(sumWeights).toBeGreaterThan(0)
  })

  it('couvre toutes les classes d’actifs sur l’ensemble des portefeuilles', () => {
    const all = SEED_PORTFOLIOS.map((p) =>
      buildSnapshot({
        portfolioId: p.id,
        transactions: SEED_TRANSACTIONS.filter((t) => t.portfolioId === p.id),
        instruments,
        quotes,
      }),
    )
    const actionTypes = new Set(all.flatMap((s) => s.positions.map((p) => p.type)))
    expect(actionTypes.has('ACTION')).toBe(true)
    expect(actionTypes.has('OPCVM')).toBe(true)
    const categories = new Set(
      all.flatMap((s) => s.positions.map((p) => p.category).filter(Boolean)),
    )
    expect(categories.size).toBeGreaterThanOrEqual(4)
    expect(SEED_TRANSACTIONS.some((t) => t.type === 'SPLIT')).toBe(true)
    expect(SEED_TRANSACTIONS.some((t) => t.type === 'AUGMENTATION_CAPITAL')).toBe(true)
    expect(SEED_TRANSACTIONS.some((t) => t.type === 'RETRAIT')).toBe(true)
    expect(SEED_TRANSACTIONS.some((t) => t.type === 'FRAIS')).toBe(true)
  })

  it('tous les cours et VL existent et sont positifs', () => {
    for (const [id, q] of quotes) {
      expect(q.close, `cours de ${id}`).toBeGreaterThan(0)
      expect(q.date).toBeTruthy()
    }
    expect(quotes.size).toBe(ALL_INSTRUMENTS.length)
  })
})
