import * as React from 'react'
import { Star } from 'lucide-react'
import { useT } from '@/i18n'
import { useStore } from '@/state/store'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/**
 * Ajoute / retire un instrument de la watchlist.
 * `watched` est optionnel : s'il n'est pas fourni, l'état est lu dans le store.
 */
export function WatchButton({
  instrumentId,
  watched,
  iconOnly = false,
  className,
}: {
  instrumentId: string
  watched?: boolean
  iconOnly?: boolean
  className?: string
}) {
  const t = useT()
  const { isWatched, toggleWatch } = useStore()
  const { push } = useToast()
  const [busy, setBusy] = React.useState(false)
  const active = watched ?? isWatched(instrumentId)

  async function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const added = await toggleWatch(instrumentId)
      push({
        title: added ? t('alerts.addToWatchlist') : t('alerts.removeFromWatchlist'),
        tone: added ? 'success' : 'default',
      })
    } finally {
      setBusy(false)
    }
  }

  const label = active ? t('alerts.removeFromWatchlist') : t('alerts.addToWatchlist')

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-anthracite-100 dark:hover:bg-anthracite-800',
          active ? 'text-amber-500' : 'text-anthracite-400 hover:text-anthracite-600',
          className,
        )}
      >
        <Star className={cn('h-4 w-4', active && 'fill-current')} />
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      className={className}
    >
      <Star className={cn(active && 'fill-current text-amber-500')} />
      {label}
    </Button>
  )
}
