/**
 * Utilitaires de génération des données de démonstration.
 * Tout est déterministe (PRNG à graine) pour que les écrans soient
 * reproductibles d'une session à l'autre.
 */

/** Dernière séance de cotation utilisée par le jeu de démonstration */
export const DATA_AS_OF = '2026-10-16'
/** Année de démarrage des séries historiques */
export const DATA_START = '2023-01-02'

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Loi normale centrée réduite (Box–Muller) */
export function gaussian(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Tous les jours ouvrables entre deux dates (exclut samedi / dimanche) */
export function businessDays(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d.getTime() <= end.getTime()) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Jours ouvrables disponibles à partir de la dernière séance, reculés de `count` */
export function lastBusinessDays(count: number, to: string = DATA_AS_OF): string[] {
  const out: string[] = []
  const d = new Date(`${to}T00:00:00Z`)
  while (out.length < count) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return out.reverse()
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4))
}

/** Année civile écoulée : première date de l'année */
export function startOfYear(year: number): string {
  return `${year}-01-01`
}

/** Trois ans avant la dernière séance */
export function yearsAgo(years: number, from: string = DATA_AS_OF): string {
  const d = new Date(`${from}T00:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}

/** Aléatoire déterministe à partir d'une clé */
export function seededRand(key: string): () => number {
  return mulberry32(hashSeed(key))
}
