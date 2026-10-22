import { XIcon } from 'lucide-react'
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { classnames } from '@/libraries/shadcn/helpers'
import {
  computeResourceMapCardPlacement,
  type ResourceMapAnchor,
  type ResourceMapCardPlacement,
} from './resource-map-anchor'

const MOBILE_BREAKPOINT = 768

/**
 * One card over the map, beside what it describes: a selected record, or the outline or pin being
 * drawn. It is a non-modal region rather than a dialog — the map behind stays workable — labelled
 * by its heading, which takes focus when the card opens so a keyboard user lands on what changed.
 * Escape inside the card closes it. Placement is `computeResourceMapCardPlacement`'s; without an
 * anchor the card sits in the top-right corner, below the breakpoint it docks at the bottom.
 */
export function ResourceMapCard({
  title,
  subtitle,
  anchor,
  onClose,
  children,
  footer,
  className,
  ref,
}: {
  /** Lets the page tell whether focus is inside the card — a select-all shortcut means the card's
   * own list there. */
  ref?: RefObject<HTMLElement | null>
  title: ReactNode
  subtitle?: ReactNode
  anchor: ResourceMapAnchor | null
  onClose?: () => void
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const headingId = useId()
  const ownRef = useRef<HTMLElement>(null)
  const cardRef = ref ?? ownRef
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [placement, setPlacement] = useState<ResourceMapCardPlacement>({ kind: 'fallback' })

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  useLayoutEffect(() => {
    const card = cardRef.current
    const container = card?.parentElement
    if (!card || !container) {
      return
    }
    const place = () =>
      setPlacement(
        computeResourceMapCardPlacement({
          anchor,
          container: { width: container.clientWidth, height: container.clientHeight },
          card: { width: card.offsetWidth, height: card.offsetHeight },
          breakpoint: MOBILE_BREAKPOINT,
        }),
      )
    place()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(place)
    observer.observe(card)
    observer.observe(container)

    return () => observer.disconnect()
  }, [anchor, cardRef])

  return (
    <aside
      aria-labelledby={headingId}
      className={classnames(
        'absolute z-20 flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl',
        placement.kind === 'docked'
          ? 'inset-x-2 bottom-2 max-h-[min(70%,38rem)]'
          : 'w-[22.5rem] max-w-[calc(100%-2rem)]',
        placement.kind === 'fallback' && 'top-4 right-4',
        className,
      )}
      data-placement={placement.kind}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onClose) {
          event.stopPropagation()
          onClose()
        }
      }}
      ref={cardRef}
      style={
        placement.kind === 'floating' ? { left: placement.left, top: placement.top } : undefined
      }
    >
      <header className="flex shrink-0 items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate font-semibold text-base outline-none"
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
          >
            {title}
          </h2>
          {subtitle && <div className="mt-0.5 text-muted-foreground text-xs">{subtitle}</div>}
        </div>
        {onClose && (
          <Button aria-label="Close" onClick={onClose} size="icon-sm" type="button" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && (
        <footer className="flex shrink-0 items-center gap-2 border-t px-4 py-3">{footer}</footer>
      )}
    </aside>
  )
}
