import { tuyauQuery } from '@/libraries/tuyau/client'

export const customerQueries = {
  list: () => tuyauQuery.customers.index.queryOptions({}),
  available: () => tuyauQuery.customers.available.queryOptions({}),
}
