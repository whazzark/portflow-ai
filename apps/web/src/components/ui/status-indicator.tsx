import { cva, type VariantProps } from 'class-variance-authority'

import { classnames } from '@/libraries/shadcn/helpers'

const statusIndicatorDotVariants = cva('size-2 shrink-0 rounded-full', {
  variants: {
    variant: {
      success: 'bg-success',
      warning: 'bg-warning',
      destructive: 'bg-destructive',
      neutral: 'bg-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
})

interface StatusIndicatorProps extends VariantProps<typeof statusIndicatorDotVariants> {
  label: string
  className?: string
}

function StatusIndicator({ label, variant, className }: StatusIndicatorProps) {
  return (
    <span
      data-slot="status-indicator"
      className={classnames('inline-flex items-center gap-1.5 text-sm', className)}
    >
      <span aria-hidden="true" className={statusIndicatorDotVariants({ variant })} />
      {label}
    </span>
  )
}

export { StatusIndicator, statusIndicatorDotVariants }
