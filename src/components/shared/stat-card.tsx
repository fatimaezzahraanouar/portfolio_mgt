import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Money } from './money'
import { formatPct } from '@/lib/format'
import { useI18n } from '@/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Delta({
  value,
  suffix,
  className,
  iconSize = 'sm',
}: {
  value: number
  suffix?: string
  className?: string
  iconSize?: 'sm' | 'xs'
}) {
  const { locale } = useI18n()
  const up = value > 0
  const flat = Math.abs(value) < 1e-9
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold tabular',
        flat
          ? 'text-anthracite-500'
          : up
            ? 'text-gain-600 dark:text-gain-500'
            : 'text-loss-600 dark:text-loss-500',
        className,
      )}
    >
      <Icon className={cn(iconSize === 'sm' ? 'h-4 w-4' : 'h-3 w-3')} />
      {formatPct(value, { locale, decimals: 2 })}
      {suffix ? <span className="font-normal opacity-70">{suffix}</span> : null}
    </span>
  )
}

interface StatCardProps {
  label: string
  value: number
  /** Variations / sous-informations */
  delta?: number
  deltaLabel?: string
  hint?: React.ReactNode
  icon?: React.ReactNode
  accent?: 'brand' | 'gain' | 'loss' | 'neutral'
  loading?: boolean
  compact?: boolean
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  icon,
  accent = 'neutral',
  compact,
}: StatCardProps) {
  const { locale } = useI18n()
  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        accent === 'brand' && 'border-brand-200 bg-gradient-to-br from-card to-brand-50/60 dark:border-brand-900 dark:from-card dark:to-brand-950/40',
      )}
    >
      <CardContent className={cn('flex flex-col gap-2', compact && 'py-1')}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {label}
          </p>
          {icon ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-anthracite-100 text-anthracite-500 dark:bg-anthracite-800">
              {icon}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <Money
            value={value}
            className={cn('text-2xl font-bold leading-none text-ink', compact && 'text-xl')}
          />
          {delta !== undefined ? <Delta value={delta} iconSize="xs" /> : null}
        </div>
        {deltaLabel || hint ? (
          <p className="text-xs text-muted">
            {deltaLabel ? <span className="font-medium">{deltaLabel}</span> : null}
            {deltaLabel && hint ? <span className="mx-1">·</span> : null}
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function MiniStat({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-anthracite-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-ink tabular">{children}</span>
    </div>
  )
}

export function CardWithHeader({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
