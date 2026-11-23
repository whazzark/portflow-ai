import type { BulkLifecycleOutcome } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import {
  describeBulkLifecycleEffect,
  describeLifecycleEffect,
  LIFECYCLE_ACTION_LABELS,
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
export function describeWarehouseLifecycleTitle(action: LifecycleAction, name: string) {
  return `${LIFECYCLE_ACTION_LABELS[action]} ${name}?`
}

/** What an archival takes out of new discharges. Counted over the *available* doors: those are the
 * ones that stop being selectable; an already archived door changes nothing for a planner. */
export function describeWarehouseArchiveEffect(availableDoors: number) {
  const outro = 'You can reactivate it later from Archived.'

  if (availableDoors === 0) {
    return `The warehouse can no longer be selected for new discharges. Past discharges keep it. ${outro}`
  }
  const doors =
    availableDoors === 1 ? 'its available door' : `its ${availableDoors} available doors`

  return `The warehouse and ${doors} can no longer be selected for new discharges. Past discharges keep them. ${outro}`
}

/** The archival toast's second line: what went with the warehouse, and where it now lives. */
export function describeWarehouseArchiveDetail(archivedDoors: number) {
  const outro = 'Find it under Archived to reactivate it.'

  if (archivedDoors === 0) {
    return outro
  }

  return archivedDoors === 1
    ? `Its door is archived with it. ${outro}`
    : `Its ${archivedDoors} doors are archived with it. ${outro}`
}

const countAvailableDoors = (warehouse: WarehouseWithDoorsDto) =>
  (warehouse.doors ?? []).filter((door) => door.status === 'AVAILABLE').length

type WarehouseLifecycleResponse = {
  data: { archivedDoorCount: number } | { reactivatedDoorCount: number }
}

function useWarehouseLifecycleConfig(
  warehouse: WarehouseWithDoorsDto,
  onViewArchived?: (warehouseId: string) => void,
): ResourceLifecycleConfig<WarehouseLifecycleResponse> {
  const mutations = useWarehouseMutations()

  return {
    singular: WAREHOUSE_SINGULAR,
    name: warehouse.name,
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshWarehouses,
    describeTitle: (action) => describeWarehouseLifecycleTitle(action, warehouse.name),
    // A reactivation keeps the canonical promise with its door clause; an archival says, as the V2
    // map does, what stops being selectable for new discharges and where to find it again.
    describeEffect: (action) =>
      action === 'reactivate'
        ? `${describeLifecycleEffect(action, warehouse.name)} ${describeDoorRestore(countDoors(warehouse))}`
        : describeWarehouseArchiveEffect(countAvailableDoors(warehouse)),
    describeSuccessDetail: (action, result) =>
      action === 'archive' && 'archivedDoorCount' in result.data
        ? describeWarehouseArchiveDetail(result.data.archivedDoorCount)
        : undefined,
    successAction: (action) =>
      action === 'archive' && onViewArchived
        ? { label: 'View', onClick: () => onViewArchived(warehouse.id) }
        : undefined,
    // The advisory count above is what the administrator was shown; this reports what the server
    // actually touched — for an archival in the toast's second line.
    describeSuccess: (action, result) => {
      if (action === 'archive') {
        return lifecycleSuccessMessage(action, WAREHOUSE_SINGULAR, warehouse.name)
      }
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
  onViewArchived,
}: {
  className?: string
  warehouse: WarehouseWithDoorsDto
  /** Offered as `View` on the archival toast: where the archived warehouse can be found again. */
  onViewArchived?: (warehouseId: string) => void
}) {
  const config = useWarehouseLifecycleConfig(warehouse, onViewArchived)

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
