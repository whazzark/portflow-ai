import { XIcon } from 'lucide-react'
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  computeResourceMapCardPlacement,
  type ResourceMapAnchor,
  type ResourceMapCardPlacement,
} from '@/components/resource-map/resource-map-anchor'
import { Button } from '@/components/ui/button'
import { classnames } from '@/libraries/shadcn/helpers'

/**
 * A card anchored next to a feature of the map — a selected record, or the pin of a record being
 * placed or moved. It is a non-modal labelled region rather than a dialog: the map stays usable
 * behind it, so another feature can be selected without closing it first.
 *
 * It renders over the map, not inside the map canvas, and follows `anchor` — the feature's position
 * in the map container's pixel space, which the map reports as it pans and zooms. Without an anchor
 * (no rendered map) it takes a fixed top-right position; on a narrow map it docks to the bottom.
 */
export function ResourceMapCard({
  title,
  subtitle,
  anchor,
  onClose,
  autoFocusHeading = true,
  footer,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  anchor: ResourceMapAnchor | null
  /** Omitted for a card that can only be left through its own actions, such as a creation form. */
  onClose?: () => void
  /** Off for a card whose first field takes focus itself. */
  autoFocusHeading?: boolean
  footer?: ReactNode
  children?: ReactNode
}) {
  const titleId = useId()
  const cardRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [placement, setPlacement] = useState<ResourceMapCardPlacement>({ layout: 'fallback' })

  // Focus follows the card when it opens, so a keyboard user lands on what they just opened.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on mount
  useEffect(() => {
    if (autoFocusHeading) {
      headingRef.current?.focus()
    }
  }, [])

  useLayoutEffect(() => {
    const card = cardRef.current
    const container = card?.offsetParent
    if (!card || !(container instanceof HTMLElement)) {
      return
    }

    const update = () =>
      setPlacement(
        computeResourceMapCardPlacement({
          anchor,
          container: { width: container.clientWidth, height: container.clientHeight },
          card: { width: card.offsetWidth, height: card.offsetHeight },
        }),
      )

    update()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(update)
    observer.observe(card)
    observer.observe(container)
    return () => observer.disconnect()
  }, [anchor])

  return (
    <aside
      aria-labelledby={titleId}
      className={classnames(
        'absolute z-20 flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg',
        placement.layout === 'docked'
          ? 'inset-x-3 bottom-3 max-h-[60%]'
          : 'w-[22.5rem] max-w-[calc(100%-2rem)]',
        placement.layout === 'fallback' && 'top-4 right-4 md:top-6 md:right-6',
      )}
      data-placement={placement.layout}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onClose && !event.defaultPrevented) {
          event.stopPropagation()
          onClose()
        }
      }}
      ref={cardRef}
      style={
        placement.layout === 'floating' ? { left: placement.left, top: placement.top } : undefined
      }
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2
            className="truncate font-heading font-semibold text-base outline-none"
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
          >
            {title}
          </h2>
          {subtitle && <div className="mt-1 text-muted-foreground text-sm">{subtitle}</div>}
        </div>
        {onClose && (
          <Button aria-label="Close" onClick={onClose} size="icon-sm" type="button" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        )}
      </div>
      {children && <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>}
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3">
          {footer}
        </div>
      )}
    </aside>
  )
}
