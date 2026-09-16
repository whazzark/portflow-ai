import { type UseQueryResult, useQuery } from '@tanstack/react-query'

import { customerQueries } from '@/features/customers/queries/customer-queries'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'

type Reference = { id: string; name: string }

/**
 * The choices a preparation field offers, and where their loading stands. The form renders at once;
 * each field shows its own loading or retry from this rather than holding the page back.
 */
export type PreparationOptions<Option> = {
  options: Option[]
  loading: boolean
  /** Present when the options failed to load. */
  onRetry?: () => void
}

export function optionsState<Data, Option>(
  query: UseQueryResult<Data>,
  toOptions: (data: Data) => Option[],
): PreparationOptions<Option> {
  return {
    options: query.data ? toOptions(query.data) : [],
    loading: query.isPending,
    onRetry: query.isError ? () => void query.refetch() : undefined,
  }
}

/**
 * A correction keeps its current reference offered even when it is no longer listed as available,
 * and even before the list has loaded, so its pre-filled value never goes blank.
 */
function withCurrent(state: PreparationOptions<Reference>, current?: Reference) {
  if (!current || state.options.some((option) => option.id === current.id)) {
    return state
  }

  return { ...state, options: [{ id: current.id, name: current.name }, ...state.options] }
}

export function useDockOptions(current?: Reference) {
  const query = useQuery(dockQueries.available())

  return withCurrent(
    optionsState(query, (response) =>
      response.data.map((dock) => ({ id: dock.id, name: dock.name })),
    ),
    current,
  )
}

export function useCustomerOptions(current?: Reference) {
  const query = useQuery(customerQueries.available())

  return withCurrent(
    optionsState(query, (response) =>
      response.data.map((customer) => ({ id: customer.id, name: customer.companyName })),
    ),
    current,
  )
}

export function useResponsibleOptions() {
  const query = useQuery(dischargeQueries.eligibleResponsibles())

  return optionsState(query, (response) => response.data)
}

export function useWeighingAreaOptions() {
  const query = useQuery(weighingAreaQueries.available())

  return optionsState(query, (response) =>
    response.data.map((area) => ({ id: area.id, name: area.name, status: area.status })),
  )
}
