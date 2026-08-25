import { tuyauQuery } from '@/libraries/tuyau/client'

export const truckQueries = {
  all: () => tuyauQuery.trucks.index.queryOptions({ staleTime: 0 }),
  available: () => tuyauQuery.trucks.available.queryOptions({ staleTime: 0 }),
  suspended: () => tuyauQuery.trucks.suspended.queryOptions({ staleTime: 0 }),
}
