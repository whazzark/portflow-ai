import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { classnames } from '@/libraries/shadcn/helpers'

type FloatingSelectionBarProps = {
  /** The toolbar's accessible name, e.g. `Selected trucks`. */
  label: string
  /** What is selected, e.g. `2 trucks selected`. Never the selected records themselves. */
  countLabel: string
  /** Empties the selection without acting on it. */
  onClear: () => void
  /** The actions on the selection, after Clear. */
  children: ReactNode
  className?: string
}

/**
 * The bar that carries the actions on a selection, kept in view at the bottom of the content while
 * the rows it acts on are scrolled.
 *
 * It sticks rather than floats over a fixed-height workspace like the directories' lifecycle
 * toolbar: a page that scrolls the document has no positioned container to pin it to, and sticking
 * keeps it inside the content column whatever the sidebar does. It is mounted only while something
 * is selected, so a hidden bar can never take focus. It stays apart from
 * `BulkResourceLifecycleActions`, whose toolbar is welded to the archive and reactivate dialog; a
 * selection with an action of its own brings that action here instead. Place it outside any
 * `overflow-hidden` ancestor such as a `Card`, which would stop it sticking.
 */
export function FloatingSelectionBar({
  label,
  countLabel,
  onClear,
  children,
  className,
}: FloatingSelectionBarProps) {
  return (
    <div
      aria-label={label}
      className={classnames(
        'motion-safe:fade-in motion-safe:slide-in-from-bottom-2 pointer-events-none sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex justify-center motion-safe:animate-in',
        className,
      )}
      role="toolbar"
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-popover px-2 py-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <span className="whitespace-nowrap px-2 font-medium text-sm tabular-nums">
          {countLabel}
        </span>
        <Button onClick={onClear} size="sm" variant="ghost">
          <XIcon aria-hidden="true" />
          Clear
        </Button>
        {children}
      </div>
    </div>
  )
}
