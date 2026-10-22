import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Takes the floating toolbar's place while the map is in a mode — placing, moving or selecting —
 * so the screen says what a click on the map will do, and offers the one way out.
 */
export function ResourceMapModeBanner({
  actionLabel,
  onAction,
  children,
}: {
  actionLabel: string
  onAction: () => void
  children: ReactNode
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-3 rounded-xl border bg-popover py-1.5 pr-1.5 pl-4 text-popover-foreground text-sm shadow-lg">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-indicator" />
      <p className="min-w-0 flex-1" role="status">
        {children}
      </p>
      <Button onClick={onAction} size="sm" type="button" variant="outline">
        {actionLabel}
      </Button>
    </div>
  )
}
