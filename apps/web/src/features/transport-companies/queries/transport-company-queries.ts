import { tuyauQuery } from '@/libraries/tuyau/client'

export const transportCompanyQueries = {
  all: () => tuyauQuery.transportCompanies.index.queryOptions({ staleTime: 0 }),
  available: () => tuyauQuery.transportCompanies.available.queryOptions({ staleTime: 0 }),
}
