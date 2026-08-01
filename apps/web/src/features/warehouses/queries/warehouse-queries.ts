import { tuyauQuery } from '@/libraries/tuyau/client'

export const warehouseQueries = {
  list: () => tuyauQuery.warehouses.index.queryOptions({}),
}
