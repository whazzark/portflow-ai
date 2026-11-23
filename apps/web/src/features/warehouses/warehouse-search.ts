import {
  normalizeResourceSearch,
  presentResources,
  resourceMatchesSearch,
} from '@/components/resource-map/resource-map-search'
import type {
  PresentedWarehouse,
  WarehouseDoorDto,
  WarehouseDto,
  WarehouseStatusFilter,
  WarehouseWithDoorsDto,
} from './types'

export const normalizeWarehouseSearch = normalizeResourceSearch

export function warehouseMatchesSearch(warehouse: Pick<WarehouseDto, 'name'>, search: string) {
  return resourceMatchesSearch(warehouse, search)
}

export function presentWarehouses(
  warehouses: WarehouseDto[],
  status: WarehouseStatusFilter,
  search: string,
): PresentedWarehouse[] {
  return presentResources(warehouses, status, search) as PresentedWarehouse[]
}

export type WarehouseSearchResult = {
  id: string
  name: string
  status: WarehouseDto['status']
  doorSummary: string
}

export type WarehouseDoorSearchResult = {
  id: string
  name: string
  status: WarehouseDoorDto['status']
  warehouseId: string
  warehouseName: string
}

export type WarehouseAndDoorSearchResults = {
  warehouses: WarehouseSearchResult[]
  doors: WarehouseDoorSearchResult[]
  /** True only when non-blank text matched nothing — blank text is not a search. */
  isEmpty: boolean
}

const STATUS_BY_FILTER: Record<WarehouseStatusFilter, WarehouseDto['status'][]> = {
  all: ['AVAILABLE', 'ARCHIVED'],
  available: ['AVAILABLE'],
  archived: ['ARCHIVED'],
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'en')

export function describeDoorSummary(doors: Pick<WarehouseDoorDto, 'status'>[]) {
  if (doors.length === 0) {
    return 'No doors'
  }
  const archived = doors.filter((door) => door.status === 'ARCHIVED').length
  const total = `${doors.length} ${doors.length === 1 ? 'door' : 'doors'}`

  return archived === 0 ? total : `${total} · ${archived} archived`
}

/**
 * Searches warehouse and door names within the selected statuses. A door is searched only when
 * both its own status and its warehouse's are selected: an archived warehouse's doors stay out of
 * an Available search even though they would be listed under it.
 */
export function searchWarehousesAndDoors(
  warehouses: WarehouseWithDoorsDto[],
  status: WarehouseStatusFilter,
  search: string,
): WarehouseAndDoorSearchResults {
  if (normalizeResourceSearch(search).length === 0) {
    return { warehouses: [], doors: [], isEmpty: false }
  }

  const statuses = STATUS_BY_FILTER[status]
  const inScope = warehouses.filter((warehouse) => statuses.includes(warehouse.status))

  const warehouseResults = inScope
    .filter((warehouse) => resourceMatchesSearch(warehouse, search))
    .map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      status: warehouse.status,
      doorSummary: describeDoorSummary(warehouse.doors ?? []),
    }))
    .sort(byName)

  const doorResults = inScope
    .flatMap((warehouse) =>
      (warehouse.doors ?? [])
        .filter((door) => statuses.includes(door.status) && resourceMatchesSearch(door, search))
        .map((door) => ({
          id: door.id,
          name: door.name,
          status: door.status,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
        })),
    )
    .sort(byName)

  return {
    warehouses: warehouseResults,
    doors: doorResults,
    isEmpty: warehouseResults.length === 0 && doorResults.length === 0,
  }
}
