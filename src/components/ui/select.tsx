import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

/**
 * Sélecteur natif stylé : accessible clavier / lecteur d'écran,
 * sans dépendance, et rendu identique sur mobile et desktop.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, invalid, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 pe-8 text-sm text-ink shadow-sm transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 disabled:opacity-50 dark:bg-anthracite-950/40',
          invalid && 'border-loss-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-anthracite-500" />
    </div>
  ),
)
Select.displayName = 'Select'
