import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** Announces a map mode — drawing, placing, moving — in place of the toolbar, with its way out. */
export function ResourceMapModeBanner({
  children,
  actionLabel,
  actionAccessibleLabel,
  onAction,
}: {
  children: ReactNode
  actionLabel: string
  /** A fuller name for screen readers — `Cancel drawing` — so the banner's way out is not confused
   * with the card's own `Cancel`. Starts with the visible label, as it must. */
  actionAccessibleLabel?: string
  onAction: () => void
}) {
  return (
    <div className="flex max-w-full items-center gap-3 rounded-xl border border-primary/40 bg-popover/95 py-1.5 pr-1.5 pl-4 text-popover-foreground text-sm shadow-md backdrop-blur">
      <p className="min-w-0 flex-1" role="status">
        {children}
      </p>
      <Button
        aria-label={actionAccessibleLabel}
        onClick={onAction}
        size="sm"
        type="button"
        variant="outline"
      >
        {actionLabel}
      </Button>
    </div>
  )
}
