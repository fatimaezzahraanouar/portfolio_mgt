import type {
  AllocationSlice,
  ContributionRow,
  OpcvmCategory,
  Position,
} from '../types'
import type { PricePoint } from '../types'

export const ALLOCATION_CLASSES = [
  'ACTIONS',
  'OPCVM_ACTIONS',
  'OBLIGATAIRES',
  'MONETAIRES',
  'DIVERSIFIES',
  'LIQUIDITES',
] as const
export type AllocationClass = (typeof ALLOCATION_CLASSES)[number]

export const ALLOCATION_META: Record<AllocationClass, { label: string; color: string }> = {
  ACTIONS: { label: 'Actions', color: '#d13c18' },
  OPCVM_ACTIONS: { label: 'OPCVM Actions', color: '#f07150' },
  OBLIGATAIRES: { label: 'Obligataires', color: '#474d5d' },
  MONETAIRES: { label: 'Monétaires', color: '#9aa1b2' },
  DIVERSIFIES: { label: 'Diversifiés', color: '#f79c7c' },
  LIQUIDITES: { label: 'Liquidités', color: '#0f9d58' },
}

const CATEGORY_TO_CLASS: Record<OpcvmCategory, AllocationClass> = {
  ACTIONS: 'OPCVM_ACTIONS',
  OBLIGATAIRE_CT: 'OBLIGATAIRES',
  OBLIGATAIRE_MLT: 'OBLIGATAIRES',
  MONETAIRE: 'MONETAIRES',
  DIVERSIFIE: 'DIVERSIFIES',
  CONTRACTUEL: 'OBLIGATAIRES',
}

export function allocationClassOf(position: Position): AllocationClass {
  if (position.type === 'ACTION') return 'ACTIONS'
  return CATEGORY_TO_CLASS[position.category ?? 'DIVERSIFIE']
}

const SECTOR_COLORS = [
  '#d13c18',
  '#474d5d',
  '#f07150',
  '#767e91',
  '#8b2714',
  '#9aa1b2',
  '#f79c7c',
  '#363b48',
  '#e6522a',
  '#c2c7d2',
]

/** Répartition par classe d'actifs (donut du tableau de bord) */
export function buildAllocation(positions: Position[], cashBalance: number): AllocationSlice[] {
  const buckets = new Map<AllocationClass, number>()
  for (const p of positions) {
    const c = allocationClassOf(p)
    buckets.set(c, (buckets.get(c) ?? 0) + p.marketValue)
  }
  if (Math.abs(cashBalance) > 1e-6) buckets.set('LIQUIDITES', cashBalance)

  const total = [...buckets.values()].reduce((s, v) => s + v, 0)
  if (total <= 0) return []

  return ALLOCATION_CLASSES.filter((c) => (buckets.get(c) ?? 0) > 1e-6)
    .map((c) => {
      const value = buckets.get(c) ?? 0
      return {
        key: c,
        label: ALLOCATION_META[c].label,
        value,
        weight: (value / total) * 100,
        color: ALLOCATION_META[c].color,
      }
    })
    .sort((a, b) => b.value - a.value)
}

/** Répartition par secteur (uniquement les lignes de type ACTION) */
export function buildSectorAllocation(
  positions: Position[],
  totalValue: number,
): AllocationSlice[] {
  const buckets = new Map<string, number>()
  for (const p of positions) {
    if (p.type !== 'ACTION') continue
    const sector = p.sector ?? 'Non renseigné'
    buckets.set(sector, (buckets.get(sector) ?? 0) + p.marketValue)
  }
  const denom = totalValue > 0 ? totalValue : 1
  const rows = [...buckets.entries()].sort((a, b) => b[1] - a[1])
  return rows.map(([sector, value], i) => ({
    key: sector,
    label: sector,
    value,
    weight: (value / denom) * 100,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }))
}

/** Poids des positions exprimé en % du total (titres + liquidités) */
export function weightsOf(positions: Position[], totalValue: number) {
  const denom = totalValue > 0 ? totalValue : 1
  return positions.map((p) => ({
    instrumentId: p.instrumentId,
    name: p.name,
    weight: (p.marketValue / denom) * 100,
  }))
}

/**
 * Contribution de chaque ligne à la performance de la période :
 * contribution ≈ poids moyen × rendement de la ligne.
 */
export function computeContributions(
  positions: Position[],
  priceHistory: Map<string, PricePoint[]>,
  from?: string,
): ContributionRow[] {
  return positions
    .map((p) => {
      const history = priceHistory.get(p.instrumentId) ?? []
      let startPrice = p.pru
      if (from) {
        const before = [...history].reverse().find((pt) => pt.date <= from)
        startPrice = before?.close ?? history[0]?.close ?? p.pru
      } else {
        startPrice = history[0]?.close ?? p.pru
      }
      const periodReturn = startPrice > 0 ? p.lastPrice / startPrice - 1 : 0
      const weight = p.weight / 100
      return {
        instrumentId: p.instrumentId,
        name: p.name,
        ticker: p.ticker,
        weight: p.weight,
        periodReturn: periodReturn * 100,
        contribution: weight * periodReturn * 100,
      }
    })
    .sort((a, b) => b.contribution - a.contribution)
}
