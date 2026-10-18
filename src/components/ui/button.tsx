import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
        secondary:
          'bg-anthracite-100 text-anthracite-800 hover:bg-anthracite-200 dark:bg-anthracite-800 dark:text-anthracite-100 dark:hover:bg-anthracite-700',
        outline:
          'border border-border bg-card text-ink hover:bg-anthracite-50 dark:hover:bg-anthracite-800',
        ghost: 'text-anthracite-600 hover:bg-anthracite-100 hover:text-ink dark:text-anthracite-300 dark:hover:bg-anthracite-800',
        destructive: 'bg-loss-600 text-white hover:bg-loss-600/90',
        success: 'bg-gain-600 text-white hover:bg-gain-600/90',
        link: 'text-brand-700 underline-offset-4 hover:underline dark:text-brand-300',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
        iconSm: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { buttonVariants }
