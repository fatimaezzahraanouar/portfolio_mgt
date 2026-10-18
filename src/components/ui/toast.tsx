import * as React from 'react'
import { Check, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastTone = 'default' | 'success' | 'error' | 'warning'

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone: ToastTone
}

interface ToastContextValue {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

let seq = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++seq
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = React.useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:end-6 sm:items-end sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-pop',
              t.tone === 'success' && 'border-gain-500/40',
              t.tone === 'error' && 'border-loss-500/40',
              t.tone === 'warning' && 'border-amber-500/40',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {t.tone === 'success' ? (
                <Check className="h-4 w-4 text-gain-600" />
              ) : t.tone === 'error' ? (
                <X className="h-4 w-4 text-loss-600" />
              ) : t.tone === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <Info className="h-4 w-4 text-brand-600" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 break-words text-xs text-muted">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-anthracite-400 hover:text-ink"
              aria-label="Fermer la notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
