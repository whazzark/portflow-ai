import type { WarehouseDoorDto, WarehouseDoorStatusFilter } from '@/features/warehouse-doors/types'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'

/** Doors carry no lifecycle of their own, so their display noun lives here rather than in a
 * `*-lifecycle` module like every other site reference's. */
export const DOOR_SINGULAR = 'door'

export function defaultDoorStatus(
  warehouseStatus: 'AVAILABLE' | 'ARCHIVED',
): WarehouseDoorStatusFilter {
  return warehouseStatus === 'AVAILABLE' ? 'available' : 'archived'
}

export function getWarehouseDoors(warehouse: WarehouseWithDoorsDto): WarehouseDoorDto[] {
  return warehouse.doors ?? []
}

export function filterWarehouseDoors(
  warehouse: WarehouseWithDoorsDto,
  status: WarehouseDoorStatusFilter,
): WarehouseDoorDto[] {
  const doors = getWarehouseDoors(warehouse)
  const expected = status === 'available' ? 'AVAILABLE' : 'ARCHIVED'
  return doors.filter((door) => door.status === expected)
}

export function countWarehouseDoors(warehouse: WarehouseWithDoorsDto) {
  const doors = getWarehouseDoors(warehouse)
  return {
    available: doors.filter((door) => door.status === 'AVAILABLE').length,
    archived: doors.filter((door) => door.status === 'ARCHIVED').length,
  }
}

export function findAdmittedDoor(
  warehouse: WarehouseWithDoorsDto,
  doorId: string | undefined,
  status: WarehouseDoorStatusFilter,
) {
  if (!doorId) {
    return undefined
  }
  return filterWarehouseDoors(warehouse, status).find((door) => door.id === doorId)
}

export function isDoorSelectionValid(
  warehouse: WarehouseWithDoorsDto,
  doorId: string | undefined,
  status: WarehouseDoorStatusFilter,
) {
  return Boolean(findAdmittedDoor(warehouse, doorId, status))
}

export function toggleDoorSelection(currentDoorId: string | undefined, nextDoorId: string) {
  return currentDoorId === nextDoorId ? undefined : nextDoorId
}

export function sortDoors(doors: WarehouseDoorDto[]) {
  return [...doors].sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id),
  )
}
