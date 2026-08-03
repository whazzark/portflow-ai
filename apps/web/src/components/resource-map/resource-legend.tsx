import { ArchiveIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { classnames } from '@/libraries/shadcn/helpers'

export type ResourceLegendEntry = {
  label: string
  symbol: ReactNode
}

export function ResourceLegendStatusSymbol({
  status,
  dataAttribute,
}: {
  status: 'AVAILABLE' | 'ARCHIVED'
  dataAttribute?: string
}) {
  const archived = status === 'ARCHIVED'

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid size-6 shrink-0 place-items-center rounded-full border-2 shadow-sm',
        archived
          ? 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground'
          : 'border-background bg-primary',
      )}
      {...(dataAttribute ? { [`data-${dataAttribute}`]: status } : {})}
    >
      {archived && (
        <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full border border-background bg-muted text-muted-foreground">
          <ArchiveIcon className="size-2" />
        </span>
      )}
    </span>
  )
}

export function ResourceLegend({
  ariaLabel,
  typeAriaLabel,
  types,
  statusAriaLabel,
  statuses,
}: {
  ariaLabel: string
  typeAriaLabel: string
  types: ResourceLegendEntry[]
  statusAriaLabel: string
  statuses: ResourceLegendEntry[]
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="pointer-events-none w-fit max-w-full rounded-lg border bg-background/95 px-3 py-2.5 text-foreground shadow-md backdrop-blur"
    >
      <div className="grid gap-2.5 sm:flex sm:items-center sm:gap-4">
        <fieldset aria-label={typeAriaLabel} className="grid gap-1.5">
          <legend className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            Type
          </legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {types.map((entry) => (
              <span className="flex items-center gap-1.5 text-xs" key={entry.label}>
                {entry.symbol}
                {entry.label}
              </span>
            ))}
          </div>
        </fieldset>
        <fieldset
          aria-label={statusAriaLabel}
          className="grid gap-1.5 border-t pt-2.5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4"
        >
          <legend className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            Status
          </legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {statuses.map((entry) => (
              <span className="flex items-center gap-1.5 text-xs" key={entry.label}>
                {entry.symbol}
                {entry.label}
              </span>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  )
}
