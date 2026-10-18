import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-anthracite-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-anthracite-950/40',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink shadow-sm placeholder:text-anthracite-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export function Label({
  className,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-xs font-medium text-anthracite-700 dark:text-anthracite-300',
        className,
      )}
      {...props}
    >
      {props.children}
      {required ? <span className="ml-0.5 text-brand-600">*</span> : null}
    </label>
  )
}

interface FieldProps {
  label?: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function Field({ label, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <Label required={required} htmlFor={undefined}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-loss-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
