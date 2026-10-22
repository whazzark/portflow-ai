import type { ReactNode } from 'react'

import { InputSearch } from '@/components/ui/input-search'
import { statusIndicatorDotVariants } from '@/components/ui/status-indicator'
import type { FleetStatus } from '@/features/transport-resources/helpers/transport-resources-search'
import { classnames } from '@/libraries/shadcn/helpers'

const PILLS = [
  { status: 'available', label: 'Available', variant: 'success' },
  { status: 'suspended', label: 'Suspended', variant: 'warning' },
  { status: 'archived', label: 'Archived', variant: 'neutral' },
] as const satisfies ReadonlyArray<{
  status: FleetStatus
  label: string
  variant: 'success' | 'warning' | 'neutral'
}>

type FleetToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  statuses: readonly FleetStatus[]
  counts: Record<FleetStatus, number>
  onStatusesChange: (statuses: FleetStatus[]) => void
  /** The administrator's Create control; absent in read-only mode. */
  create?: ReactNode
}

export function FleetToolbar({
  search,
  onSearchChange,
  statuses,
  counts,
  onStatusesChange,
  create,
}: FleetToolbarProps) {
  const toggle = (status: FleetStatus) => {
    const pressed = statuses.includes(status)

    // The last selected status stays: an empty selection would only ever show an empty table.
    if (pressed && statuses.length === 1) {
      return
    }

    onStatusesChange(
      pressed ? statuses.filter((current) => current !== status) : [...statuses, status],
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputSearch
        fieldClassName="w-full sm:w-[340px]"
        id="transport-resources-search"
        label="Search transport resources"
        onValueChange={onSearchChange}
        placeholder="Search registration, model or company"
        value={search}
      />
      <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">Filter by truck status</legend>
        {PILLS.map(({ status, label, variant }) => {
          const pressed = statuses.includes(status)

          return (
            <button
              aria-pressed={pressed}
              className={classnames(
                'inline-flex h-[30px] items-center gap-2 rounded-full border px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                pressed
                  ? 'border-primary bg-muted font-semibold text-foreground'
                  : 'border-border font-medium text-muted-foreground hover:bg-muted/50',
              )}
              key={status}
              onClick={() => toggle(status)}
              type="button"
            >
              <span aria-hidden="true" className={statusIndicatorDotVariants({ variant })} />
              {label}{' '}
              <span className="font-normal text-muted-foreground tabular-nums">
                {counts[status]}
              </span>
            </button>
          )
        })}
      </fieldset>
      {create && <div className="ml-auto">{create}</div>}
    </div>
  )
}
