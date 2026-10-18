import { Eye, EyeOff } from 'lucide-react'
import { usePreferences } from '@/state/preferences'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'

interface MoneyProps {
  value: number
  className?: string
  /** Devise différente de la devise d'affichage par défaut */
  currency?: string
  decimals?: number
  compact?: boolean
  /** Force l'affichage même si les montants sont masqués */
  reveal?: boolean
  /** Masque toujours (champs de saisie) */
  hideMaskable?: boolean
}

/**
 * Rendit monétaire central : respecte la devise d'affichage, la locale
 * et le bouton « masquer les montants » (confidentialité).
 */
export function Money({
  value,
  className,
  currency,
  decimals,
  compact,
  reveal,
  hideMaskable,
}: MoneyProps) {
  const { maskAmounts } = usePreferences()
  const { locale } = useI18n()
  const masked = maskAmounts && !reveal && !hideMaskable

  return (
    <span
      className={cn('tabular', masked && 'amount-masked', className)}
      aria-label={masked ? 'montant masqué' : undefined}
    >
      {formatMoney(value, { locale, currency, decimals, compact })}
    </span>
  )
}

export function MaskToggle({ className }: { className?: string }) {
  const { maskAmounts, toggleMask } = usePreferences()
  return (
    <button
      type="button"
      onClick={toggleMask}
      aria-pressed={maskAmounts}
      aria-label={maskAmounts ? 'Afficher les montants' : 'Masquer les montants'}
      title={maskAmounts ? 'Afficher les montants' : 'Masquer les montants'}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-anthracite-500 transition-colors hover:text-ink',
        maskAmounts && 'border-brand-300 text-brand-700',
        className,
      )}
    >
      {maskAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}
