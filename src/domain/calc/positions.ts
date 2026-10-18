import type {
  CashSummary,
  Instrument,
  PortfolioSnapshot,
  Position,
  Quote,
  Transaction,
} from '../types'

/** Précision monétaire (évite la dérive des flottants) */
const EPS = 1e-6
const round = (n: number, p = 6) => Math.round(n * 10 ** p) / 10 ** p

/** Prix de revient unitaire : coût moyen pondéré (achats + frais) */
export function weightedAverageCost(buyCost: number, quantity: number): number {
  if (quantity <= EPS) return 0
  return buyCost / quantity
}

/** Plus-value latente : (cours actuel − PRU) × quantité */
export function unrealizedPnl(lastPrice: number, pru: number, quantity: number): number {
  return (lastPrice - pru) * quantity
}

export interface RealizedEvent {
  date: string
  instrumentId: string
  quantity: number
  price: number
  proceeds: number
  costRemoved: number
  realizedPnl: number
  fees: number
  taxes: number
}

export interface PositionEngineOptions {
  portfolioId: string
  transactions: Transaction[]
  instruments: Map<string, Instrument>
  quotes: Map<string, Quote>
  /** Prix de clôture par instrument, triés par date croissante */
  priceHistory?: Map<string, Array<{ date: string; close: number }>>
  /** Date de valorisation (AAAA-MM-JJ), défaut = dernière date connue */
  valuationDate?: string
}

interface Accumulator {
  instrumentId: string
  quantity: number
  cost: number
  realizedPnl: number
  income: number
  invested: number
}

/**
 * Moteur de réduction : transforme le journal des opérations en positions.
 *
 * Règles :
 *  - ACHAT / SOUSCRIPTION / AUGMENTATION_CAPITAL → quantité ↑, coût ↑ (frais + taxes inclus)
 *  - VENTE / RACHAT → plus-value réalisée, coût résiduel ↓ (CMP)
 *  - SPLIT → quantité × ratio, PRU ÷ ratio
 *  - ATTRIBUTION_GRATUITE → quantité ↑, coût inchangé (PRU ↓)
 *  - DIVIDENDE / COUPON → liquidités ↑ (montant brut − retenue)
 *  - DÉPÔT / RETRAIT → flux externes
 *  - FRAIS → sorties de trésorerie internes
 */
export function buildSnapshot(opts: PositionEngineOptions): PortfolioSnapshot {
  const { portfolioId, transactions, instruments, quotes } = opts

  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  const acc = new Map<string, Accumulator>()
  const cash: CashSummary = { deposits: 0, withdrawals: 0, fees: 0, income: 0, balance: 0 }
  const realizedEvents: RealizedEvent[] = []

  for (const tx of sorted) {
    const a = tx.instrumentId
      ? (acc.get(tx.instrumentId) ?? ensureAcc(acc, tx.instrumentId))
      : null
    const fees = tx.fees ?? 0
    const taxes = tx.taxes ?? 0
    const qty = tx.quantity ?? 0
    const price = tx.price ?? 0

    switch (tx.type) {
      case 'ACHAT':
      case 'SOUSCRIPTION':
      case 'AUGMENTATION_CAPITAL': {
        const gross = qty * price
        const total = gross + fees + taxes
        if (a) {
          a.quantity += qty
          a.cost += total
          a.invested += total
        }
        cash.fees += fees + taxes
        cash.balance -= total
        break
      }
      case 'VENTE':
      case 'RACHAT': {
        if (!a) break
        const sellQty = Math.min(qty, a.quantity)
        const pru = a.quantity > EPS ? a.cost / a.quantity : 0
        const costRemoved = round(pru * sellQty)
        const gross = sellQty * price
        const proceeds = gross - fees - taxes
        const realized = round(proceeds - costRemoved)
        a.realizedPnl += realized
        a.quantity = round(a.quantity - sellQty)
        a.cost = round(Math.max(0, a.cost - costRemoved))
        if (a.quantity <= EPS) {
          a.quantity = 0
          a.cost = 0
        }
        cash.balance += proceeds
        cash.fees += fees + taxes
        realizedEvents.push({
          date: tx.date,
          instrumentId: tx.instrumentId!,
          quantity: sellQty,
          price,
          proceeds,
          costRemoved,
          realizedPnl: realized,
          fees,
          taxes,
        })
        break
      }
      case 'SPLIT': {
        // tx.quantity = ratio (2 = « 2 pour 1 »)
        if (!a || qty <= 0) break
        a.quantity = round(a.quantity * qty)
        break
      }
      case 'ATTRIBUTION_GRATUITE': {
        if (!a) break
        a.quantity = round(a.quantity + qty)
        break
      }
      case 'DIVIDENDE':
      case 'COUPON': {
        const gross = tx.amount ?? 0
        const net = gross - taxes
        if (a) a.income += net
        cash.income += net
        cash.balance += net
        break
      }
      case 'DEPOT': {
        cash.deposits += tx.amount ?? 0
        cash.balance += tx.amount ?? 0
        break
      }
      case 'RETRAIT': {
        cash.withdrawals += tx.amount ?? 0
        cash.balance -= tx.amount ?? 0
        break
      }
      case 'FRAIS': {
        cash.fees += tx.amount ?? 0
        cash.balance -= tx.amount ?? 0
        break
      }
    }
  }

  /* ---------------- Positions ouvertes ---------------- */
  const positions: Position[] = []
  let holdingsValue = 0
  let dayChangeAbs = 0
  let realizedPnlTotal = 0
  let investedTotal = 0
  let unrealizedTotal = 0

  for (const a of acc.values()) {
    realizedPnlTotal += a.realizedPnl
    investedTotal += a.invested
    if (a.quantity <= EPS) continue

    const inst = instruments.get(a.instrumentId)
    const quote = quotes.get(a.instrumentId)
    const pru = round(a.cost / a.quantity)
    const lastPrice = quote?.close ?? pru
    const priceDate = quote?.date ?? opts.valuationDate ?? ''
    const marketValue = round(lastPrice * a.quantity)
    const prevPrice = quote ? quote.close / (1 + (quote.changePct ?? 0) / 100) : lastPrice
    const lineDay = round((lastPrice - prevPrice) * a.quantity)

    holdingsValue += marketValue
    dayChangeAbs += lineDay
    unrealizedTotal += marketValue - a.cost

    positions.push({
      portfolioId,
      instrumentId: a.instrumentId,
      type: inst?.type ?? 'ACTION',
      ticker: inst?.ticker ?? '—',
      name: inst?.name ?? a.instrumentId,
      sector: inst?.sector,
      category: inst?.category,
      quantity: round(a.quantity),
      pru,
      cost: round(a.cost),
      lastPrice,
      priceDate,
      marketValue,
      unrealizedPnl: round(marketValue - a.cost),
      unrealizedPnlPct: a.cost > EPS ? round(((marketValue - a.cost) / a.cost) * 100, 4) : 0,
      dayChangePct: quote?.changePct ?? 0,
      weight: 0,
      realizedPnl: round(a.realizedPnl),
      income: round(a.income),
      invested: round(a.invested),
    })
  }

  const totalValue = round(holdingsValue + cash.balance)
  const denom = totalValue > EPS ? totalValue : 1
  for (const p of positions) p.weight = round((p.marketValue / denom) * 100, 4)
  positions.sort((a, b) => b.marketValue - a.marketValue)

  const prevHoldings = holdingsValue - dayChangeAbs
  const dayChangePct = prevHoldings > EPS ? (dayChangeAbs / prevHoldings) * 100 : 0

  return {
    portfolioId,
    positions,
    cash: {
      deposits: round(cash.deposits),
      withdrawals: round(cash.withdrawals),
      fees: round(cash.fees),
      income: round(cash.income),
      balance: round(cash.balance),
    },
    holdingsValue: round(holdingsValue),
    totalValue,
    invested: round(investedTotal),
    unrealizedPnl: round(unrealizedTotal),
    realizedPnl: round(realizedPnlTotal),
    dayChangeAbs: round(dayChangeAbs),
    dayChangePct: round(dayChangePct, 4),
  }
}

function ensureAcc(map: Map<string, Accumulator>, id: string): Accumulator {
  const existing = map.get(id)
  if (existing) return existing
  const fresh: Accumulator = { instrumentId: id, quantity: 0, cost: 0, realizedPnl: 0, income: 0, invested: 0 }
  map.set(id, fresh)
  return fresh
}

/**
 * Agrège plusieurs portefeuilles (option « Tous les portefeuilles »).
 * Les positions sont fusionnées ligne à ligne, les trésoreries additionnées.
 */
export function mergeSnapshots(
  snapshots: PortfolioSnapshot[],
  portfolioId = 'all',
): PortfolioSnapshot {
  const positions = new Map<string, Position>()
  const cash: CashSummary = { deposits: 0, withdrawals: 0, fees: 0, income: 0, balance: 0 }

  for (const snap of snapshots) {
    cash.deposits += snap.cash.deposits
    cash.withdrawals += snap.cash.withdrawals
    cash.fees += snap.cash.fees
    cash.income += snap.cash.income
    cash.balance += snap.cash.balance

    for (const p of snap.positions) {
      const existing = positions.get(p.instrumentId)
      if (!existing) {
        positions.set(p.instrumentId, { ...p, portfolioId })
        continue
      }
      const totalQty = existing.quantity + p.quantity
      existing.cost += p.cost
      existing.quantity = totalQty
      existing.pru = totalQty > EPS ? existing.cost / totalQty : 0
      existing.marketValue += p.marketValue
      existing.realizedPnl += p.realizedPnl
      existing.income += p.income
      existing.invested += p.invested
      existing.unrealizedPnl = existing.marketValue - existing.cost
      existing.unrealizedPnlPct =
        existing.cost > EPS ? ((existing.marketValue - existing.cost) / existing.cost) * 100 : 0
    }
  }

  const list = [...positions.values()]
  const holdingsValue = list.reduce((s, p) => s + p.marketValue, 0)
  const totalValue = holdingsValue + cash.balance
  const denom = totalValue > EPS ? totalValue : 1
  for (const p of list) p.weight = (p.marketValue / denom) * 100
  list.sort((a, b) => b.marketValue - a.marketValue)

  const unrealized = list.reduce((s, p) => s + p.unrealizedPnl, 0)
  const realized = list.reduce((s, p) => s + p.realizedPnl, 0)
  const invested = list.reduce((s, p) => s + p.invested, 0)

  const dayChangeAbs = snapshots.reduce((s, p) => s + p.dayChangeAbs, 0)
  const prevHoldings = holdingsValue - dayChangeAbs

  return {
    portfolioId,
    positions: list,
    cash: {
      deposits: cash.deposits,
      withdrawals: cash.withdrawals,
      fees: cash.fees,
      income: cash.income,
      balance: cash.balance,
    },
    holdingsValue,
    totalValue,
    invested,
    unrealizedPnl: unrealized,
    realizedPnl: realized,
    dayChangeAbs,
    dayChangePct: prevHoldings > EPS ? (dayChangeAbs / prevHoldings) * 100 : 0,
  }
}

/** Calcule la plus-value réalisée de chaque opération de vente (pour l'historique) */
export function realizedEventsOf(transactions: Transaction[]): RealizedEvent[] {
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })
  const qty = new Map<string, { q: number; cost: number }>()
  const events: RealizedEvent[] = []

  for (const tx of sorted) {
    if (!tx.instrumentId) continue
    const a = qty.get(tx.instrumentId) ?? { q: 0, cost: 0 }
    const fees = tx.fees ?? 0
    const taxes = tx.taxes ?? 0
    const q = tx.quantity ?? 0
    const price = tx.price ?? 0
    switch (tx.type) {
      case 'ACHAT':
      case 'SOUSCRIPTION':
      case 'AUGMENTATION_CAPITAL':
        a.q += q
        a.cost += q * price + fees + taxes
        break
      case 'VENTE':
      case 'RACHAT': {
        const sq = Math.min(q, a.q)
        const pru = a.q > EPS ? a.cost / a.q : 0
        const costRemoved = round(pru * sq)
        const proceeds = sq * price - fees - taxes
        events.push({
          date: tx.date,
          instrumentId: tx.instrumentId,
          quantity: sq,
          price,
          proceeds: round(proceeds),
          costRemoved,
          realizedPnl: round(proceeds - costRemoved),
          fees,
          taxes,
        })
        a.q = round(a.q - sq)
        a.cost = round(Math.max(0, a.cost - costRemoved))
        break
      }
      case 'SPLIT':
        a.q = round(a.q * q)
        break
      case 'ATTRIBUTION_GRATUITE':
        a.q = round(a.q + q)
        break
    }
    qty.set(tx.instrumentId, a)
  }
  return events
}
