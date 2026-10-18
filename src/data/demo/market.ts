import type { IndexCode, IndexQuote, PricePoint, Quote } from '@/domain/types'
import {
  DATA_AS_OF,
  DATA_START,
  businessDays,
  gaussian,
  seededRand,
  yearsAgo,
} from './constants'
import { ACTION_SPECS, FUND_SPECS, type ActionSpec, type FundSpec } from './instruments'

/* ------------------------------------------------------------------ */
/* Génération de séries (déterministe)                                 */
/* ------------------------------------------------------------------ */

/**
 * Série de prix générée par marche aléatoire à dérive, puis re-échelonnée
 * pour que le dernier point corresponde au cours de référence.
 */
export function generatePriceSeries(
  key: string,
  endPrice: number,
  days: string[],
  vol: number,
  drift: number,
): PricePoint[] {
  const rand = seededRand(key)
  const raw: number[] = [1]
  for (let i = 1; i < days.length; i++) {
    const z = gaussian(rand)
    const r = drift + vol * z
    raw.push(Math.max(0.05, raw[i - 1] * (1 + r)))
  }
  const scale = endPrice / raw[raw.length - 1]
  return days.map((date, i) => ({ date, close: round2(raw[i] * scale) }))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

const SESSIONS = businessDays(DATA_START, DATA_AS_OF)
/** Vendredis uniquement : fréquence de publication des VL */
const VL_DATES = SESSIONS.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 5)

/* ------------------------------------------------------------------ */
/* Actions : cours & cotations                                          */
/* ------------------------------------------------------------------ */

const actionSeriesCache = new Map<string, PricePoint[]>()
const actionSpecMap = new Map<string, ActionSpec>(ACTION_SPECS.map((s) => [s.ticker, s]))

export function priceHistoryOf(ticker: string): PricePoint[] {
  const cached = actionSeriesCache.get(ticker)
  if (cached) return cached
  const spec = actionSpecMap.get(ticker)
  if (!spec) return []
  const series = generatePriceSeries(`A:${ticker}`, spec.price, SESSIONS, spec.vol, spec.drift)
  actionSeriesCache.set(ticker, series)
  return series
}

export function quoteOf(ticker: string): Quote | null {
  const spec = actionSpecMap.get(ticker)
  const series = priceHistoryOf(ticker)
  if (!spec || series.length < 2) return null
  const last = series[series.length - 1]
  const prev = series[series.length - 2]
  const changePct = round4((last.close / prev.close - 1) * 100)
  const volume = Math.round((60_000 + seededRand(`V:${ticker}`)() * 900_000) * (1 + changePct / 40))
  const dividendYield = (spec.dividendPerShare / last.close) * 100
  return {
    instrumentId: ticker,
    date: last.date,
    close: last.close,
    changePct,
    volume,
    marketCap: Math.round(last.close * spec.shares),
    per: round2(last.close / spec.eps),
    dividendPerShare: spec.dividendPerShare,
    dividendYield: round2(dividendYield),
  }
}

export function allActionQuotes(): Quote[] {
  return ACTION_SPECS.map((s) => quoteOf(s.ticker)).filter((q): q is Quote => q !== null)
}

/** Cours de référence de « hier » utilisé par la mise à jour manuelle */
export function manualPriceOf(ticker: string): number | null {
  return priceHistoryOf(ticker).at(-1)?.close ?? null
}

/* ------------------------------------------------------------------ */
/* OPCVM : historique de VL                                              */
/* ------------------------------------------------------------------ */

const navCache = new Map<string, PricePoint[]>()
const fundSpecMap = new Map<string, FundSpec>(FUND_SPECS.map((s) => [s.id, s]))

export function navHistoryOf(fundId: string): PricePoint[] {
  const cached = navCache.get(fundId)
  if (cached) return cached
  const spec = fundSpecMap.get(fundId)
  if (!spec) return []
  const series = generatePriceSeries(`F:${fundId}`, spec.nav, VL_DATES, spec.vol, spec.drift)
  // La dernière VL publiée porte la date effective (J ou J+1)
  series[series.length - 1] = { date: spec.navDate, close: spec.nav }
  navCache.set(fundId, series)
  return series
}

export function latestNav(fundId: string): { nav: number; date: string } | null {
  const h = navHistoryOf(fundId)
  const last = h[h.length - 1]
  return last ? { nav: last.close, date: last.date } : null
}

export function quoteOfFund(fundId: string): Quote | null {
  const spec = fundSpecMap.get(fundId)
  const h = navHistoryOf(fundId)
  if (!spec || h.length < 3) return null
  const last = h[h.length - 1]
  const prev = h[h.length - 2]
  return {
    instrumentId: fundId,
    date: last.date,
    close: last.close,
    changePct: round4((last.close / prev.close - 1) * 100),
  }
}

/** Rendement d'un fonds sur une période (YTD, 1A, 3A…) */
export function fundReturn(fundId: string, fromDate?: string, toDate = DATA_AS_OF): number | null {
  const h = navHistoryOf(fundId)
  if (h.length < 2) return null
  const end = h.filter((p) => p.date <= toDate).at(-1)
  if (!end) return null
  const start = fromDate
    ? [...h].reverse().find((p) => p.date <= fromDate && p.date <= end.date)
    : h[0]
  if (!start || start.close <= 0) return null
  return round4((end.close / start.close - 1) * 100)
}

export function yearStart(year: number): string {
  return `${year}-01-01`
}

/** Date « il y a N années » par rapport à la dernière séance */
export function agoYears(n: number): string {
  return yearsAgo(n)
}

/* ------------------------------------------------------------------ */
/* Indices                                                              */
/* ------------------------------------------------------------------ */

interface IndexSpec {
  code: IndexCode
  name: string
  end: number
  vol: number
  drift: number
}

const INDEX_SPECS: IndexSpec[] = [
  { code: 'MASI', name: 'MASI', end: 16_842.35, vol: 0.0072, drift: 0.00024 },
  { code: 'MSI20', name: 'MSI20', end: 1_428.6, vol: 0.0081, drift: 0.00022 },
  { code: 'MASI_BANQUES', name: 'MASI Banques', end: 12_540.75, vol: 0.0087, drift: 0.00035 },
]

const indexCache = new Map<IndexCode, PricePoint[]>()

export function indexHistory(code: IndexCode): PricePoint[] {
  const cached = indexCache.get(code)
  if (cached) return cached
  const spec = INDEX_SPECS.find((s) => s.code === code)
  if (!spec) return []
  const series = generatePriceSeries(`I:${code}`, spec.end, SESSIONS, spec.vol, spec.drift)
  indexCache.set(code, series)
  return series
}

export function indexQuote(code: IndexCode): IndexQuote {
  const spec = INDEX_SPECS.find((s) => s.code === code)!
  const h = indexHistory(code)
  const last = h[h.length - 1]
  const prev = h[h.length - 2]
  return {
    code,
    name: spec.name,
    value: last.close,
    changePct: round4((last.close / prev.close - 1) * 100),
  }
}

export function allIndexQuotes(): IndexQuote[] {
  return INDEX_SPECS.map((s) => indexQuote(s.code))
}

/** Historique combiné de tous les actifs (actions + OPCVM) */
export function buildPriceHistoryMap(): Map<string, PricePoint[]> {
  const map = new Map<string, PricePoint[]>()
  for (const s of ACTION_SPECS) map.set(s.ticker, priceHistoryOf(s.ticker))
  for (const s of FUND_SPECS) map.set(s.id, navHistoryOf(s.id))
  return map
}

export const AS_OF = DATA_AS_OF
