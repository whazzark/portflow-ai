import { tuyauQuery } from '@/libraries/tuyau/client'

export const weighingAreaQueries = {
  list: () => tuyauQuery.weighingAreas.index.queryOptions({}),
}
