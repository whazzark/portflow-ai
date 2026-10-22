import { tuyauQuery } from '@/libraries/tuyau/client'

export const dischargeQueries = {
  all: () => tuyauQuery.discharges.index.queryOptions({ staleTime: 0 }),
  // Refetched on every visit, like the list: a discharge's lots, shifts, and assignments change
  // elsewhere, and a detail read from cache would present stale preparation as current.
  detail: (id: string) =>
    tuyauQuery.discharges.show.queryOptions({ params: { id } }, { staleTime: 0 }),
  // Refetched whenever a planning sheet opens: another discharge may take a door at any moment,
  // and a door or weighing area may be archived in the meantime.
  planningOptions: (id: string) =>
    tuyauQuery.discharges.planningOptions.queryOptions({ params: { id } }, { staleTime: 0 }),
  // Refetched on every opening of the start confirmation, and never retried: the answer only holds
  // for the moment it was read, and a failure is shown with its own retry.
  startCheck: (id: string) =>
    tuyauQuery.discharges.startCheck.queryOptions(
      { params: { id } },
      { staleTime: 0, gcTime: 0, retry: false },
    ),
  // The same check, read by a planned discharge's page for what blocks its start. Kept apart from
  // the confirmation's own read, so opening it still asks afresh and shows its own failures; nested
  // under its key, so whatever invalidates the check refreshes the banner too. Never retried: a
  // failure simply shows nothing.
  startBlockers: (id: string) => {
    const options = tuyauQuery.discharges.startCheck.queryOptions(
      { params: { id } },
      { staleTime: 0, retry: false },
    )

    const queryKey = [...options.queryKey, ['blockers']] as unknown as typeof options.queryKey

    return { ...options, queryKey }
  },
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
