import type { Route } from '@tuyau/core/types'

export type WarehouseDto = Route.Response<'warehouses.index'>['data'][number]
export type WarehouseStatus = WarehouseDto['status']
export type WarehouseStatusFilter = 'all' | 'available' | 'archived'

export type WarehousePoint = WarehouseDto['footprint']['points'][number]

export type PresentedWarehouse = WarehouseDto & {
  isSearchMatch: boolean
}
