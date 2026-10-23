import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

/** Where focus goes back when a creation started from the toolbar is cancelled. */
export const CREATE_BUTTON_ID = 'transport-resources-create'

/**
 * Create, split as drawn: the screen holds two resources and neither is the obvious default, so
 * both halves open the same choice rather than one of them guessing.
 */
export function CreateMenu({
  disabled,
  onCreateTruck,
  onCreateCompany,
}: {
  disabled: boolean
  onCreateTruck: () => void
  onCreateCompany: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex">
      <Button
        className="rounded-r-none"
        disabled={disabled}
        id={CREATE_BUTTON_ID}
        onClick={() => setOpen(true)}
        size="lg"
        type="button"
      >
        <PlusIcon aria-hidden="true" />
        Create
      </Button>
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Choose what to create"
              className="rounded-l-none border-primary-foreground/20 border-l"
              disabled={disabled}
              size="icon-lg"
              type="button"
            />
          }
        >
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCreateTruck}>Truck</DropdownMenuItem>
          <DropdownMenuItem onClick={onCreateCompany}>Transport company</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
