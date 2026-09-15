import { tuyauQuery } from '@/libraries/tuyau/client'

export const dischargeQueries = {
  all: () => tuyauQuery.discharges.index.queryOptions({ staleTime: 0 }),
  // Refetched on every visit, like the list: a discharge's lots, shifts, and assignments change
  // elsewhere, and a detail read from cache would present stale preparation as current.
  detail: (id: string) =>
    tuyauQuery.discharges.show.queryOptions({ params: { id } }, { staleTime: 0 }),
  // Refetched on every visit to the creation page: an operations lead's access may have changed.
  eligibleResponsibles: () =>
    tuyauQuery.users.eligibleShiftResponsibles.queryOptions({}, { staleTime: 0 }),
  // Refetched on every opening: trucks are reserved, suspended, and released by others meanwhile.
  truckCandidates: (dischargeId: string) =>
    tuyauQuery.discharges.truckPool.candidates.queryOptions(
      { params: { dischargeId } },
      { staleTime: 0 },
    ),
}
