import type { Locale } from '@/domain/types'

const INTL_LOCALE: Record<Locale, string> = {
  fr: 'fr-MA',
  en: 'en-GB',
  // chiffres latins pour rester lisible dans les deux sens de lecture
  ar: 'ar-MA-u-nu-latn',
}

export const CURRENCY_LABEL: Record<string, string> = {
  MAD: 'MAD',
  EUR: 'EUR',
  USD: 'USD',
}

const FX: Record<string, number> = { MAD: 1, EUR: 0.093, USD: 0.1 } // taux indicatifs

function nf(locale: Locale, opts: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'fr-MA', opts)
}

/** Format monétaire marocain : « 1 234 567,89 MAD » */
export function formatMoney(
  value: number,
  opts: { locale?: Locale; currency?: string; decimals?: number; compact?: boolean } = {},
): string {
  const { locale = 'fr', currency = 'MAD', decimals = 2, compact = false } = opts
  const converted = (value ?? 0) * (FX[currency] ?? 1)
  if (compact && Math.abs(converted) >= 100_000) {
    const unit = Math.abs(converted) >= 1_000_000 ? 'M' : 'k'
    const scaled =
      unit === 'M' ? converted / 1_000_000 : converted / 1_000
    return `${nf(locale, {
      notation: 'standard',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(scaled)} ${unit} ${currency}`
  }
  return `${nf(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted)} ${currency}`
}

export function formatNumber(
  value: number,
  opts: { locale?: Locale; decimals?: number; compact?: boolean } = {},
): string {
  const { locale = 'fr', decimals = 2, compact = false } = opts
  return nf(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard',
  }).format(value ?? 0)
}

/** Pourcentage signé : « +1,24 % » */
export function formatPct(
  value: number,
  opts: { locale?: Locale; decimals?: number; sign?: boolean } = {},
): string {
  const { locale = 'fr', decimals = 2, sign = true } = opts
  const v = value ?? 0
  const body = nf(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(v))
  const prefix = sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : ''
  return `${prefix}${body} %`
}

export function formatDate(iso: string, locale: Locale = 'fr'): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'fr-MA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function formatDateLong(iso: string, locale: Locale = 'fr'): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'fr-MA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function formatDateTime(iso: string, locale: Locale = 'fr'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Date ISO du jour (AAAA-MM-JJ) */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Classes couleur selon le signe d'un montant / pourcentage */
export function signClass(value: number): string {
  if (value > 0) return 'text-gain-600 dark:text-gain-500'
  if (value < 0) return 'text-loss-600 dark:text-loss-500'
  return 'text-anthracite-600 dark:text-anthracite-300'
}

export function arrowOf(value: number): '▲' | '▼' | '■' {
  if (value > 0) return '▲'
  if (value < 0) return '▼'
  return '■'
}
