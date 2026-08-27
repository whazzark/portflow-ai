import type { BulkLifecycleOutcome } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import {
  describeBulkLifecycleEffect,
  describeLifecycleEffect,
  type LifecycleAction,
  lifecycleSuccessMessage,
} from '@/components/lifecycle/lifecycle-copy'
import {
  ResourceLifecycleActions,
  type ResourceLifecycleConfig,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useWarehouseMutations } from '@/features/warehouses/mutations/use-warehouse-mutations'
import type {
  BulkWarehouseLifecycleResult,
  WarehouseWithDoorsDto,
} from '@/features/warehouses/types'

export const WAREHOUSE_SINGULAR = 'warehouse'
export const WAREHOUSE_PLURAL = 'warehouses'

/** A warehouse is blocked by one of its *doors*, not by itself. */
export const WAREHOUSE_BLOCKER_REASON_LABELS = {
  IN_USE: 'a door is used by an active or planned discharge',
}

export function warehouseLifecycleActions(
  status: WarehouseWithDoorsDto['status'],
): LifecycleAction[] {
  return status === 'ARCHIVED' ? ['reactivate'] : ['archive']
}

/** Every lifecycle transition a warehouse carries, for its detail pane. The read contract exposes
 * only `archivedByUserId`, so no actor is reported yet. */
export function warehouseLifecycleBlocks(warehouse: WarehouseWithDoorsDto): LifecycleBlock[] {
  return [
    { action: 'archive', at: warehouse.archivedAt, comment: warehouse.archiveComment },
    { action: 'reactivate', at: warehouse.reactivatedAt, comment: warehouse.reactivationComment },
  ]
}

/** Counted from the doors already embedded in the warehouse, so the confirmation needs no extra
 * request. It is advisory: the authoritative set is assessed when the transition is submitted, and
 * the reported outcome — not this number — says what was written.
 *
 * One count serves both directions, because both take every door the warehouse holds: archiving it
 * archives all of them, reactivating it brings all of them back. Nothing filters on the door's own
 * status — a door archived on its own is taken over by the archival like any other, and a warehouse
 * that is archived holds no available door to skip. */
export function countDoors(warehouse: WarehouseWithDoorsDto) {
  return (warehouse.doors ?? []).length
}

/** Total doors across a selection, advisory in exactly the same way. */
export function countDoorsIn(warehouses: WarehouseWithDoorsDto[]) {
  return warehouses.reduce((total, warehouse) => total + countDoors(warehouse), 0)
}

export function describeDoorCascade(doors: number) {
  if (doors === 0) {
    return 'It has no door to archive with it.'
  }

  return doors === 1
    ? 'Its 1 door is archived with it and stays readable.'
    : `Its ${doors} doors are archived with it and stay readable.`
}

export function describeDoorRestore(doors: number) {
  if (doors === 0) {
    return 'No door returns to service with it.'
  }

  return doors === 1 ? 'Its 1 door returns to service.' : `Its ${doors} doors return to service.`
}

export function describeBulkDoorRestore(warehouseCount: number, doors: number) {
  // Both counts vary independently and either can be 1, so every clause agrees on its own subject
  // rather than borrowing the door count's number for the warehouse sentence.
  const them = warehouseCount === 1 ? 'it' : 'them'

  if (doors === 0) {
    return `No door returns to service with ${them}.`
  }

  return `${warehouseCount === 1 ? 'Its' : 'Their'} ${
    doors === 1 ? '1 door returns' : `${doors} doors return`
  } to service.`
}

export function describeBulkDoorCascade(warehouseCount: number, doors: number) {
  // Both counts vary independently and either can be 1, so every clause agrees on its own subject
  // rather than borrowing the door count's number for the warehouse sentence.
  const oneWarehouse = warehouseCount === 1
  const them = oneWarehouse ? 'it' : 'them'

  if (doors === 0) {
    return `${oneWarehouse ? 'It has' : 'They have'} no door to archive with ${them}.`
  }

  return `${oneWarehouse ? 'Its' : 'Their'} ${
    doors === 1 ? '1 door is' : `${doors} doors are`
  } archived with ${them}.`
}

/** The two directions return different envelopes; only the response itself proves which came back. */
type WarehouseLifecycleResponse = {
  data: { archivedDoorCount: number } | { reactivatedDoorCount: number }
}

function useWarehouseLifecycleConfig(
  warehouse: WarehouseWithDoorsDto,
): ResourceLifecycleConfig<WarehouseLifecycleResponse> {
  const mutations = useWarehouseMutations()

  return {
    singular: WAREHOUSE_SINGULAR,
    name: warehouse.name,
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshWarehouses,
    // The door clause is appended to the canonical sentence rather than replacing it: the promise
    // the administrator reads about the warehouse is the same one every other resource makes.
    describeEffect: (action) =>
      `${describeLifecycleEffect(action, warehouse.name)} ${
        action === 'reactivate'
          ? describeDoorRestore(countDoors(warehouse))
          : describeDoorCascade(countDoors(warehouse))
      }`,
    // The advisory count above is what the administrator was shown; this reports what the server
    // actually touched.
    describeSuccess: (action, result) => {
      const changedDoors =
        'reactivatedDoorCount' in result.data
          ? result.data.reactivatedDoorCount
          : result.data.archivedDoorCount

      return changedDoors === 0
        ? lifecycleSuccessMessage(action, WAREHOUSE_SINGULAR, warehouse.name)
        : `${lifecycleSuccessMessage(action, WAREHOUSE_SINGULAR, warehouse.name)} with ${changedDoors} ${
            changedDoors === 1 ? 'door' : 'doors'
          }`
    },
    submit: (action, body) => {
      const params = { id: warehouse.id }

      return action === 'reactivate'
        ? mutations.reactivate.mutateAsync({ params, body })
        : mutations.archive.mutateAsync({ params, body })
    },
  }
}

export function WarehouseLifecycleActions({
  className,
  warehouse,
}: {
  className?: string
  warehouse: WarehouseWithDoorsDto
}) {
  const config = useWarehouseLifecycleConfig(warehouse)

  return (
    <ResourceLifecycleActions
      actions={warehouseLifecycleActions(warehouse.status)}
      className={className}
      config={config}
    />
  )
}

/** The bulk confirmation's sentence: the canonical promise, then what happens to the doors. */
export function describeBulkWarehouseEffect(
  action: LifecycleAction,
  warehouseCount: number,
  doorCount: number,
) {
  const doors =
    action === 'reactivate'
      ? describeBulkDoorRestore(warehouseCount, doorCount)
      : describeBulkDoorCascade(warehouseCount, doorCount)

  return `${describeBulkLifecycleEffect(
    action,
    warehouseCount,
    WAREHOUSE_SINGULAR,
    WAREHOUSE_PLURAL,
  )} ${doors}`
}

export function toBulkWarehouseLifecycleOutcome(
  result: BulkWarehouseLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedWarehouses.length,
    blocked: result.blockedWarehouses,
  }
}
