import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} {...props} />
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-anthracite-50/70 dark:hover:bg-anthracite-800/50', className)}
      {...props}
    />
  )
}

export function TH({
  className,
  align = 'start',
  ...props
}: Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'align'> & {
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <th
      className={cn(
        'h-10 whitespace-nowrap px-2 text-[11px] font-semibold uppercase tracking-wide text-anthracite-500',
        align === 'end' && 'text-end',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  align = 'start',
  ...props
}: Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'align'> & {
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <td
      className={cn(
        'px-2 py-2.5 align-middle text-sm',
        align === 'end' && 'text-end tabular',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

/** En-tête de colonne cliquable (tri) */
export function SortHeader({
  label,
  active,
  dir = 'asc',
  onClick,
  align = 'start',
  className,
}: {
  label: React.ReactNode
  active?: boolean
  dir?: 'asc' | 'desc'
  onClick?: () => void
  align?: 'start' | 'end' | 'center'
  className?: string
}) {
  return (
    <TH align={align} className={cn('select-none', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 rounded transition-colors hover:text-ink',
          active && 'text-brand-700 dark:text-brand-400',
          align === 'end' && 'flex-row-reverse',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TH>
  )
}
