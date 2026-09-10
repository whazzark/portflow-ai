import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'

import { InputSearch } from '@/components/ui/input-search'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { groupByStatus, orderForStatus } from '@/features/discharges/discharge-collections'
import { dischargeMatchesSearch } from '@/features/discharges/discharge-search'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { DISCHARGE_STATUS_FILTERS, type DischargeStatusFilter } from '@/features/discharges/types'
import { DischargeList } from '@/features/discharges/ui/discharge-list'

const dischargesRoute = getRouteApi('/_authenticated/discharges')

const TAB_LABELS = {
  active: 'Active',
  closed: 'Closed',
  planned: 'Planned',
} as const satisfies Record<DischargeStatusFilter, string>

// Planned before active before closed: the order the site's work moves through, not the order the
// tabs were built in.
const TAB_ORDER: DischargeStatusFilter[] = ['active', 'planned', 'closed']

function isDischargeStatusFilter(value: string): value is DischargeStatusFilter {
  return DISCHARGE_STATUS_FILTERS.includes(value as DischargeStatusFilter)
}

export function DischargesPage() {
  const { search, status } = dischargesRoute.useSearch()
  const navigate = dischargesRoute.useNavigate()

  const dischargesQuery = useQuery(dischargeQueries.all())
  const discharges = useMemo(() => dischargesQuery.data?.data ?? [], [dischargesQuery.data])
  // Counted before the search narrows anything: the badge is the status total, not the match count.
  const collections = useMemo(() => groupByStatus(discharges), [discharges])
  const visible = useMemo(
    () =>
      orderForStatus(
        collections[status].filter((discharge) => dischargeMatchesSearch(discharge, search)),
        status,
      ),
    [collections, search, status],
  )
  const isNoMatch = collections[status].length > 0 && visible.length === 0

  const updateSearch = (value: string) => {
    // Replaced rather than pushed: a search should not fill the history stack keystroke by
    // keystroke, but it still has to survive a reload and travel in a shared link.
    void navigate({ replace: true, search: (previous) => ({ ...previous, search: value }) })
  }

  const updateStatus = (nextStatus: string) => {
    if (!isDischargeStatusFilter(nextStatus)) {
      return
    }

    void navigate({ search: (previous) => ({ ...previous, status: nextStatus }) })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
      {/* Sr-only, as on every other page: the header's breadcrumb already names the page. */}
      <h1 className="sr-only">Discharges</h1>

      <div className="flex items-end justify-between gap-4">
        <InputSearch
          className="w-full max-w-xl"
          id="discharge-search"
          label="Search discharges"
          onValueChange={updateSearch}
          placeholder="Search by vessel, IMO, dock, customer, or product"
          value={search}
        />
      </div>

      <Tabs className="min-h-0 flex-1" onValueChange={updateStatus} value={status}>
        <TabsList aria-label="Discharge status" variant="line">
          {TAB_ORDER.map((filter) => (
            <TabsTrigger key={filter} value={filter}>
              {TAB_LABELS[filter]}{' '}
              {/* The status total, deliberately not narrowed by the search. */}
              <span className="text-muted-foreground tabular-nums">
                ({collections[filter].length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_ORDER.map((filter) => (
          <TabsContent className="min-h-0 md:overflow-hidden" key={filter} value={filter}>
            {status === filter && (
              <DischargeList discharges={visible} isNoMatch={isNoMatch} status={filter} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
