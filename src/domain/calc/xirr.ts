import type { FlowType, Transaction } from '../types'

export interface CashFlow {
  date: string
  /** Montant signé du point de vue de l'investisseur : versement < 0, retrait > 0 */
  amount: number
  type: FlowType
}

/** Extrait les flux externes (dépôts / retraits) du journal d'opérations */
export function extractFlows(transactions: Transaction[]): CashFlow[] {
  const flows: CashFlow[] = []
  for (const tx of transactions) {
    if (tx.type === 'DEPOT' || tx.type === 'RETRAIT') {
      const amount = tx.amount ?? 0
      if (Math.abs(amount) < 1e-9) continue
      flows.push({
        date: tx.date,
        amount: tx.type === 'DEPOT' ? -amount : amount,
        type: tx.type,
      })
    }
  }
  return flows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

const dayMs = 86_400_000

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / dayMs
}

/**
 * Taux interne de rendement annualisé (XIRR).
 *
 * Flux externes : versements (négatifs), retraits (positifs) + valeur terminale
 * à la date d'aujourd'hui. Newton-Raphson avec repli par bissection.
 * Retourne le taux annuel (ex: 0.0842 = 8,42 %/an) ou null si non convergent.
 */
export function xirr(flows: CashFlow[], terminalValue: number, asOf: string): number | null {
  if (flows.length === 0) return null

  // Date de référence = première date de flux (convention XIRR)
  const base = flows.reduce((min, f) => (f.date < min ? f.date : min), asOf)
  const points: Array<{ t: number; amount: number }> = flows.map((f) => ({
    t: daysBetween(base, f.date) / 365,
    amount: f.amount,
  }))
  points.push({ t: Math.max(0, daysBetween(base, asOf) / 365), amount: terminalValue })

  const hasPositive = points.some((p) => p.amount > 0)
  const hasNegative = points.some((p) => p.amount < 0)
  if (!hasPositive || !hasNegative) return null

  const npv = (rate: number): number =>
    points.reduce((sum, p) => sum + p.amount / Math.pow(1 + rate, p.t), 0)

  // Newton-Raphson
  let rate = 0.1
  for (let i = 0; i < 60; i++) {
    const f = npv(rate)
    if (Math.abs(f) < 1e-8) return rate
    // dérivée numérique
    const h = 1e-6
    const df = (npv(rate + h) - f) / h
    if (!isFinite(df) || Math.abs(df) < 1e-12) break
    const next = rate - f / df
    if (!isFinite(next)) break
    if (Math.abs(next - rate) < 1e-10) return next
    rate = next
    if (rate < -0.9999) rate = -0.9999
    if (rate > 1e7) rate = 1e7
  }

  // Bissection robuste
  let lo = -0.9999
  let hi = 1e7
  let fLo = npv(lo)
  let fHi = npv(hi)
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-9) return mid
    if (fLo * fMid < 0) {
      hi = mid
      fHi = fMid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}
