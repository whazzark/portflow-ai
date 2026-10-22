import type { ReactNode } from 'react'
import { classnames } from '@/libraries/shadcn/helpers'

/** The floating bar over a map: search, filters, and the page's actions, wrapping on narrow
 * screens. */
export function ResourceMapToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={classnames(
        'flex max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover/95 p-1.5 text-popover-foreground shadow-md backdrop-blur',
        className,
      )}
    >
      {children}
    </div>
  )
}

export type ResourceMapToggleItem<Value extends string> = {
  value: Value
  label: string
  count?: number
  pressed: boolean
}

/**
 * Cumulative toggles with counts — statuses, types. The last pressed toggle is disabled: a filter
 * cannot be released down to nothing. `countNoun` completes each toggle's accessible name, e.g.
 * `Available, 6 warehouses`.
 */
export function ResourceMapToggleGroup<Value extends string>({
  label,
  items,
  countNoun,
  onToggle,
  className,
}: {
  label: string
  items: ResourceMapToggleItem<Value>[]
  countNoun?: string
  onToggle: (value: Value) => void
  className?: string
}) {
  const pressedCount = items.filter((item) => item.pressed).length

  return (
    <fieldset
      aria-label={label}
      className={classnames('flex items-center gap-1 rounded-lg bg-muted p-0.5', className)}
    >
      {items.map((item) => (
        <button
          aria-label={
            item.count === undefined
              ? item.label
              : `${item.label}, ${item.count}${countNoun ? ` ${countNoun}` : ''}`
          }
          aria-pressed={item.pressed}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
          disabled={item.pressed && pressedCount === 1}
          key={item.value}
          onClick={() => onToggle(item.value)}
          type="button"
        >
          <span aria-hidden="true">{item.label}</span>
          {item.count !== undefined && (
            <span aria-hidden="true" className="font-mono text-[11px] tabular-nums opacity-80">
              {item.count}
            </span>
          )}
        </button>
      ))}
    </fieldset>
  )
}
