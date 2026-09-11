import { tuyauQuery } from '@/libraries/tuyau/client'

export const dischargeQueries = {
  all: () => tuyauQuery.discharges.index.queryOptions({ staleTime: 0 }),
  // Refetched on every visit, like the list: a discharge's lots, shifts, and assignments change
  // elsewhere, and a detail read from cache would present stale preparation as current.
  detail: (id: string) =>
    tuyauQuery.discharges.show.queryOptions({ params: { id } }, { staleTime: 0 }),
}
