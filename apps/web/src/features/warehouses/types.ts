import type { Route } from '@tuyau/core/types'

type ApiWarehouseDto = Route.Response<'warehouses.index'>['data'][number]

/** Derived from the read contract rather than hand-written, so the lifecycle context each door
 * carries — including `archivedWithWarehouse` — follows the API without a second declaration. */
export type WarehouseDoorDto = ApiWarehouseDto['doors'][number]
export type WarehouseDto = Omit<ApiWarehouseDto, 'doors'> & { doors?: WarehouseDoorDto[] }
export type WarehouseWithDoorsDto = WarehouseDto
export type WarehouseStatus = WarehouseDto['status']
export type WarehouseStatusFilter = 'all' | 'available' | 'archived'

export type WarehousePoint = WarehouseDto['footprint']['points'][number]

export type PresentedWarehouse = WarehouseWithDoorsDto & {
  isSearchMatch: boolean
}

export type BulkWarehouseLifecycleResult = Route.Response<'warehouses.archive_many'>['data']
export type BulkWarehouseLifecycleBlocker =
  BulkWarehouseLifecycleResult['blockedWarehouses'][number]
