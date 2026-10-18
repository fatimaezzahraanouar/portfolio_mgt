import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const styles = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300',
  success: 'border-gain-500/30 bg-gain-500/10 text-gain-700 dark:text-gain-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400',
  danger: 'border-loss-500/30 bg-loss-500/10 text-loss-700 dark:text-loss-400',
  neutral: 'border-border bg-anthracite-50 text-anthracite-700 dark:bg-anthracite-800/60 dark:text-anthracite-200',
} as const

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
} as const

export function Alert({
  variant = 'info',
  title,
  className,
  children,
  icon: Icon,
}: {
  variant?: keyof typeof styles
  title?: React.ReactNode
  children?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  const DefaultIcon = icons[variant]
  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm', styles[variant], className)}
    >
      <span className="mt-0.5 shrink-0">
        {Icon ?? <DefaultIcon className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        {children ? <div className="mt-0.5 text-xs leading-relaxed opacity-90">{children}</div> : null}
      </div>
    </div>
  )
}
