import type { ReactNode } from 'react'
import { classnames } from '@/libraries/shadcn/helpers'

/** The floating bar over a map holding its search, filters and actions. Wraps on a narrow map so
 * every control stays reachable. */
export function ResourceMapToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
      {children}
    </div>
  )
}

/** A thin vertical rule between toolbar groups; hidden from assistive technology. */
export function ResourceMapToolbarSeparator() {
  return <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
}

export type ResourceMapToggleItem<TValue extends string> = {
  value: TValue
  label: string
  count: number
  icon?: ReactNode
}

/**
 * Cumulative filter toggles: each item is on or off independently, and the group reports the next
 * set of pressed values. The last pressed item is disabled, so the group never filters everything
 * out.
 */
export function ResourceMapToggleGroup<TValue extends string>({
  label,
  items,
  pressed,
  onChange,
}: {
  label: string
  items: readonly ResourceMapToggleItem<TValue>[]
  pressed: readonly TValue[]
  onChange: (pressed: TValue[]) => void
}) {
  return (
    <fieldset aria-label={label} className="m-0 flex min-w-0 items-center gap-1 border-0 p-0">
      {items.map((item) => {
        const isPressed = pressed.includes(item.value)
        const isLast = isPressed && pressed.length === 1

        return (
          <button
            aria-label={`${item.label} ${item.count}`}
            aria-pressed={isPressed}
            className={classnames(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-medium text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed',
              isPressed
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            disabled={isLast}
            key={item.value}
            onClick={() =>
              onChange(
                isPressed
                  ? pressed.filter((value) => value !== item.value)
                  : items
                      .map((entry) => entry.value)
                      .filter((value) => value === item.value || pressed.includes(value)),
              )
            }
            type="button"
          >
            {item.icon}
            {item.label}
            <span className="rounded-sm bg-muted px-1.5 text-muted-foreground text-xs tabular-nums">
              {item.count}
            </span>
          </button>
        )
      })}
    </fieldset>
  )
}
