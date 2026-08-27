import type { BulkLifecycleOutcome } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import {
  type ResourceLifecycleConfig,
  ResourceLifecycleDialog,
} from '@/components/lifecycle/resource-lifecycle-actions'
import { useWarehouseDoorMutations } from '@/features/warehouse-doors/mutations/use-warehouse-door-mutations'
import type {
  BulkWarehouseDoorLifecycleResult,
  WarehouseDoorDto,
} from '@/features/warehouse-doors/types'
import type { WarehouseStatus } from '@/features/warehouses/types'

/** The panel is titled "Doors" under its warehouse's own name, so the bare noun reads right in the
 * confirmation, the toast, and the bulk bar alike. */
export const WAREHOUSE_DOOR_SINGULAR = 'door'
export const WAREHOUSE_DOOR_PLURAL = 'doors'

/**
 * A door is archivable only while both it and its containing warehouse are available — the same
 * pair the row already gates `Edit` on, and what the API re-decides under lock.
 *
 * Reactivation is #216's: an archived door offers nothing here, so `ResourceRowActions` renders no
 * menu at all rather than one with a dead entry.
 */
export function warehouseDoorLifecycleActions(
  doorStatus: WarehouseDoorDto['status'],
  warehouseStatus: WarehouseStatus,
): LifecycleAction[] {
  return doorStatus === 'AVAILABLE' && warehouseStatus === 'AVAILABLE' ? ['archive'] : []
}

/**
 * Neither `describeEffect` nor `describeSuccess` is overridden. A warehouse overrides the first
 * because archiving one cascades onto its doors, and a door cascades onto nothing — the canonical
 * sentence, "<name> remains readable but is no longer available for new operations.", is already
 * exactly true. And the canonical toast already names the door: `lifecycleSuccessMessage` and
 * `lifecycleFailureTitle` quote the record on both paths, which is what lets an administrator
 * archiving one row out of a list of near-identical siblings confirm they retired the one they
 * meant.
 *
 * No refusal-message map lives here either, deliberately. `ResourceLifecycleDialog` already
 * shows the API's own message — "Warehouse door is used by a planned or active discharge", "Warehouse door is
 * already archived", "Warehouse door not found" — and each is distinct and actionable as written.
 * Translating them again on the client would put a second home for the same wording next to the
 * server's, which is exactly what the single-home rule for durable knowledge forbids. The bulk bar
 * needs its own labels only because a blocker reason arrives as a code with no sentence attached,
 * and even there the shared defaults already fit a door (`warehouse-door-selection` and
 * `BulkResourceLifecycleActions`).
 */
export function useWarehouseDoorLifecycleConfig(door: WarehouseDoorDto): ResourceLifecycleConfig {
  const mutations = useWarehouseDoorMutations()

  return {
    singular: WAREHOUSE_DOOR_SINGULAR,
    name: door.name,
    isPending: mutations.archive.isPending,
    refresh: mutations.refreshWarehouseDoors,
    submit: (_action, body) => mutations.archive.mutateAsync({ params: { id: door.id }, body }),
  }
}

export function WarehouseDoorLifecycleDialog({
  action,
  door,
  onClose,
}: {
  action: LifecycleAction
  door: WarehouseDoorDto
  onClose: () => void
}) {
  const config = useWarehouseDoorLifecycleConfig(door)

  return <ResourceLifecycleDialog action={action} config={config} onClose={onClose} />
}

/**
 * Adapts the bulk endpoint's envelope onto the shape the shared action bar reads. Nothing else is
 * translated: the blocker reasons keep the shared default labels, because a door is blocked by
 * itself — unlike a warehouse, which had to override `IN_USE` to say "a door is used by…".
 */
export function toBulkWarehouseDoorLifecycleOutcome(
  result: BulkWarehouseDoorLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedDoors.length,
    blocked: result.blockedDoors,
  }
}
