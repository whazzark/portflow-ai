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
