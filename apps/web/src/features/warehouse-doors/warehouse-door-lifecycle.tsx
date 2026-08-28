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

/** The one reason a door adds to the shared four. Its warehouse is archived while the door itself
 * is not — a state the cascade makes unreachable from the interface, so this exists to keep a
 * crafted submission's outcome readable rather than to name something an administrator will meet. */
export const WAREHOUSE_DOOR_BLOCKER_REASON_LABELS = {
  WAREHOUSE_ARCHIVED: 'its warehouse is archived',
}

/**
 * A door is archivable only while both it and its containing warehouse are available — the same
 * pair the row already gates `Edit` on, and what the API re-decides under lock.
 *
 * It comes back on its own under exactly one condition beyond being archived: its warehouse is
 * available. Archiving a warehouse takes every door it holds (#210) and reactivating it gives every
 * one of them back (#211), so a door under an archived warehouse is archived *with* it by
 * definition — its remedy is the warehouse's own reactivation, which restores it in the same
 * action, not a second submission here.
 *
 * Under an archived warehouse a door therefore offers nothing at all, and `ResourceRowActions`
 * renders no menu rather than one with a dead entry.
 */
export function warehouseDoorLifecycleActions(
  door: WarehouseDoorDto,
  warehouseStatus: WarehouseStatus,
): LifecycleAction[] {
  if (warehouseStatus !== 'AVAILABLE') {
    return []
  }

  return door.status === 'AVAILABLE' ? ['archive'] : ['reactivate']
}

/**
 * Neither `describeEffect` nor `describeSuccess` is overridden. A warehouse overrides the first
 * because archiving one cascades onto its doors, and a door cascades onto nothing — the canonical
 * sentence, "<name> remains readable but is no longer available for new operations.", is already
 * exactly true; a door reactivation has nothing to add to the canonical wording either. And the
 * canonical toast already names the door: `lifecycleSuccessMessage` and `lifecycleFailureTitle`
 * quote the record on both paths, which is what lets an administrator archiving one row out of a
 * list of near-identical siblings confirm they retired the one they meant.
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
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshWarehouseDoors,
    submit: (action, body) =>
      action === 'reactivate'
        ? mutations.reactivate.mutateAsync({ params: { id: door.id }, body })
        : mutations.archive.mutateAsync({ params: { id: door.id }, body }),
  }
}

/**
 * The confirmation on its own, for the row menu: it owns the mutation hooks so a door row runs none
 * of them until an administrator actually opens a confirmation.
 */
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
 * itself — unlike a warehouse, which had to override `IN_USE` to say "a door is used by…". The one
 * addition is `WAREHOUSE_ARCHIVED` above, which the shared four have no entry for at all.
 */
export function toBulkWarehouseDoorLifecycleOutcome(
  result: BulkWarehouseDoorLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedDoors.length,
    blocked: result.blockedDoors,
  }
}
