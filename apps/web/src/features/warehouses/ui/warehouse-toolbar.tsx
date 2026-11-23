import { PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  ResourceMapToggleGroup,
  ResourceMapToolbar,
} from '@/components/resource-map/resource-map-toolbar'
import { Button } from '@/components/ui/button'
import {
  type StatusPill,
  statusSelectionFromFilter,
  toggleStatusSelection,
} from '@/features/warehouses/status-selection'
import type { WarehouseStatusFilter } from '@/features/warehouses/types'

/** Search, the Available/Archived pills, and — for an administrator — `Create warehouse`. */
export function WarehouseToolbar({
  search,
  status,
  counts,
  onStatusChange,
  onCreate,
}: {
  search: ReactNode
  status: WarehouseStatusFilter
  counts: Record<StatusPill, number>
  onStatusChange: (status: WarehouseStatusFilter) => void
  /** Absent — not disabled — for anyone who may not create a warehouse. */
  onCreate?: () => void
}) {
  const selection = statusSelectionFromFilter(status)

  return (
    <ResourceMapToolbar>
      {search}
      <ResourceMapToggleGroup
        countNoun="warehouses"
        items={(['available', 'archived'] as const).map((pill) => ({
          value: pill,
          label: pill === 'available' ? 'Available' : 'Archived',
          count: counts[pill],
          pressed: selection[pill],
        }))}
        label="Filter by warehouse status"
        onToggle={(pill) => onStatusChange(toggleStatusSelection(status, pill))}
      />
      {onCreate && (
        <Button onClick={onCreate} size="sm" type="button">
          <PlusIcon aria-hidden="true" />
          Create warehouse
        </Button>
      )}
    </ResourceMapToolbar>
  )
}
