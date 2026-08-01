import {
  normalizeResourceSearch,
  presentResources,
  resourceMatchesSearch,
} from '@/components/resource-map/resource-map-search'
import type { PresentedWarehouse, WarehouseDto, WarehouseStatusFilter } from './types'

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
