import type { WarehouseStatusFilter } from './types'

export type StatusPill = 'available' | 'archived'
export type StatusSelection = Record<StatusPill, boolean>

/** The toolbar's two cumulative pills read and write the route's single `status` param, so links
 * already in circulation keep meaning what they meant: both pressed is `all`. */
export function statusSelectionFromFilter(status: WarehouseStatusFilter): StatusSelection {
  return {
    available: status !== 'archived',
    archived: status !== 'available',
  }
}

export function filterFromStatusSelection(selection: StatusSelection): WarehouseStatusFilter {
  if (selection.available && selection.archived) {
    return 'all'
  }
  return selection.archived ? 'archived' : 'available'
}

/** Releasing the last pressed pill is a no-op: a map filtered down to nothing shows nothing. */
export function toggleStatusSelection(
  status: WarehouseStatusFilter,
  pill: StatusPill,
): WarehouseStatusFilter {
  const selection = statusSelectionFromFilter(status)
  const next = { ...selection, [pill]: !selection[pill] }

  return next.available || next.archived ? filterFromStatusSelection(next) : status
}
