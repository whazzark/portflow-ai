import type { Route } from '@tuyau/core/types'

export type WarehouseDoorDto = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
  latitude: number
  longitude: number
}
type ApiWarehouseDto = Route.Response<'warehouses.index'>['data'][number]
export type WarehouseDto = Omit<ApiWarehouseDto, 'doors'> & { doors?: WarehouseDoorDto[] }
export type WarehouseWithDoorsDto = WarehouseDto
export type WarehouseStatus = WarehouseDto['status']
export type WarehouseStatusFilter = 'all' | 'available' | 'archived'

export type WarehousePoint = WarehouseDto['footprint']['points'][number]

export type PresentedWarehouse = WarehouseWithDoorsDto & {
  isSearchMatch: boolean
}
