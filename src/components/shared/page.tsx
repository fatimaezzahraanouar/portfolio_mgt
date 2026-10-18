import * as React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-anthracite-50/50 px-6 py-10 text-center dark:bg-anthracite-900/30',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-anthracite-400 shadow-sm">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** État vide affiché pendant le chargement */
export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-skeleton h-12 rounded-lg bg-anthracite-200/60 dark:bg-anthracite-800"
          style={{ opacity: 1 - i * 0.09 }}
        />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-skeleton h-28 bg-anthracite-200/50 dark:bg-anthracite-800" />
      ))}
    </div>
  )
}
