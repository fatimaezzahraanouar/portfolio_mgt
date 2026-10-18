import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4',
  {
    variants: {
      variant: {
        default: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300',
        secondary:
          'border-anthracite-200 bg-anthracite-100 text-anthracite-700 dark:border-anthracite-700 dark:bg-anthracite-800 dark:text-anthracite-200',
        gain: 'border-gain-500/30 bg-gain-500/10 text-gain-600 dark:text-gain-500',
        loss: 'border-loss-500/30 bg-loss-500/10 text-loss-600 dark:text-loss-500',
        outline: 'border-border text-anthracite-600 dark:text-anthracite-300',
        warning:
          'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-skeleton rounded-lg bg-anthracite-200/70 dark:bg-anthracite-800',
        className,
      )}
      {...props}
    />
  )
}

export function Separator({
  className,
  vertical,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { vertical?: boolean }) {
  return (
    <div
      role="separator"
      className={cn(
        vertical ? 'w-px self-stretch' : 'h-px w-full',
        'bg-border',
        className,
      )}
      {...props}
    />
  )
}
