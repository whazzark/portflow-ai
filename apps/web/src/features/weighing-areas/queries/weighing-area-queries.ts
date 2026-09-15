import { tuyauQuery } from '@/libraries/tuyau/client'

export const weighingAreaQueries = {
  list: () => tuyauQuery.weighingAreas.index.queryOptions({}),
  // Refetched on every opening of a shift correction: areas are archived and reactivated meanwhile.
  available: () => tuyauQuery.weighingAreas.available.queryOptions({}, { staleTime: 0 }),
}
