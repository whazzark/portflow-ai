import type { Route } from '@tuyau/core/types'
import type { WarehouseDoorDto, WarehouseStatus } from '@/features/warehouses/types'

export type { WarehouseDoorDto }
export type WarehouseDoorStatus = WarehouseDoorDto['status']
export type WarehouseDoorStatusFilter = 'available' | 'archived'

export type PresentedWarehouseDoor = WarehouseDoorDto & {
  isSelected: boolean
  isAdmitted: boolean
  offset: [number, number]
}

export type WarehouseDoorContext = {
  warehouseId: string
  warehouseStatus: WarehouseStatus
  doorStatus: WarehouseDoorStatusFilter
}

export type BulkWarehouseDoorLifecycleResult =
  Route.Response<'warehouse_doors.archive_many'>['data']
export type BulkWarehouseDoorLifecycleBlocker =
  BulkWarehouseDoorLifecycleResult['blockedDoors'][number]
