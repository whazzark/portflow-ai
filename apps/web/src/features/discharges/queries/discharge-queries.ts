import { tuyauQuery } from '@/libraries/tuyau/client'

export const dischargeQueries = {
  all: () => tuyauQuery.discharges.index.queryOptions({ staleTime: 0 }),
}
