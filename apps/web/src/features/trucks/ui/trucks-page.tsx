import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { useEffect } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import type { TruckDto } from '@/features/trucks/types'
import { TruckDetails } from '@/features/trucks/ui/truck-details'
import { TruckOverview } from '@/features/trucks/ui/truck-overview'
import { TruckSection } from '@/features/trucks/ui/truck-section'
import { TrucksError } from '@/features/trucks/ui/trucks-error'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

type TrucksPageProps = {
  embedded?: boolean
}

export function TrucksPage({ embedded = false }: TrucksPageProps) {
  const user = useAuthenticatedUser()
  const administrator = isAdministrator(user)
  const { transportCompanyId, truckStatus, truckSearch, truckId } =
    transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()
  const trucksQuery = useQuery(administrator ? truckQueries.all() : truckQueries.available())
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const companies = companiesQuery.data?.data ?? []
  const trucks = (trucksQuery.data?.data ?? []) as TruckDto[]
  const scopedTrucks = transportCompanyId
    ? trucks.filter((truck) => truck.transportCompanyId === transportCompanyId)
    : trucks
  const selected = scopedTrucks.find((truck) => truck.id === truckId)

  useEffect(() => {
    if (!administrator && truckStatus === 'archived') {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, truckId: undefined, truckStatus: 'available' }),
      })
    }
  }, [administrator, navigate, truckStatus])

  useEffect(() => {
    if (truckId && trucksQuery.data && !selected) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, truckId: undefined }),
      })
    }
  }, [navigate, selected, truckId, trucksQuery.data])

  useEffect(() => {
    if (!selected || !administrator) {
      return
    }

    const selectedStatus = selected.status === 'ARCHIVED' ? 'archived' : 'available'
    if (selectedStatus !== truckStatus) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, truckStatus: selectedStatus }),
      })
    }
  }, [administrator, navigate, selected, truckStatus])

  if (trucksQuery.isError || companiesQuery.isError) {
    return (
      <TrucksError onRetry={() => Promise.all([trucksQuery.refetch(), companiesQuery.refetch()])} />
    )
  }

  if (!trucksQuery.data || !companiesQuery.data) {
    return null
  }

  const available = scopedTrucks.filter((truck) => truck.status === 'AVAILABLE')
  const archived = administrator ? scopedTrucks.filter((truck) => truck.status === 'ARCHIVED') : []
  const selectedTrucks = truckStatus === 'archived' && administrator ? archived : available
  const toggleTruck = (id: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        truckId: previous.truckId === id ? undefined : id,
      }),
    })
  }

  const directory = (
    <Card
      aria-label="Truck directory"
      className={
        embedded
          ? 'h-[min(42rem,70svh)] min-h-[28rem] gap-0 py-0 lg:h-auto lg:min-h-0'
          : 'h-[min(42rem,70svh)] min-h-[28rem] gap-0 py-0 lg:h-auto lg:min-h-0'
      }
    >
      <CardContent className="flex min-h-0 flex-1 flex-col px-0">
        <div className="border-b p-3">
          <Field>
            <FieldLabel className="sr-only" htmlFor="truck-search">
              Search trucks
            </FieldLabel>
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                id="truck-search"
                onChange={(event) =>
                  navigate({
                    replace: true,
                    search: (previous) => ({ ...previous, truckSearch: event.target.value }),
                  })
                }
                placeholder="Search by registration or company"
                value={truckSearch}
              />
            </div>
          </Field>
        </div>
        <Tabs
          className="min-h-0 flex-1 gap-0"
          onValueChange={(value) => {
            if (value === 'available' || (administrator && value === 'archived')) {
              void navigate({
                search: (previous) => ({
                  ...previous,
                  truckId: undefined,
                  truckStatus: value,
                }),
              })
            }
          }}
          value={administrator ? truckStatus : 'available'}
        >
          <TabsList aria-label="Truck status" className="mx-3 mt-3" variant="line">
            <TabsTrigger value="available">
              Available{' '}
              <span className="text-muted-foreground tabular-nums">({available.length})</span>
            </TabsTrigger>
            {administrator && (
              <TabsTrigger value="archived">
                Archived{' '}
                <span className="text-muted-foreground tabular-nums">({archived.length})</span>
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent className="min-h-0" value="available">
            {(truckStatus === 'available' || !administrator) && (
              <TruckSection
                lifecycle="available"
                onSelect={toggleTruck}
                search={truckSearch}
                selectedId={truckId}
                trucks={selectedTrucks}
                companies={companies}
              />
            )}
          </TabsContent>
          {administrator && (
            <TabsContent className="min-h-0" value="archived">
              {truckStatus === 'archived' && (
                <TruckSection
                  lifecycle="archived"
                  onSelect={toggleTruck}
                  search={truckSearch}
                  selectedId={truckId}
                  trucks={selectedTrucks}
                  companies={companies}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )

  if (embedded) {
    return (
      <>
        {directory}
        <Sheet
          onOpenChange={(open) => {
            if (!open) {
              void navigate({ search: (previous) => ({ ...previous, truckId: undefined }) })
            }
          }}
          open={Boolean(selected)}
        >
          <SheetContent aria-label="Truck details" className="overflow-y-auto">
            {selected && (
              <TruckDetails
                company={companies.find((company) => company.id === selected.transportCompanyId)}
                truck={selected}
              />
            )}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:h-full lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] lg:overflow-hidden">
      {directory}
      <Card className="min-h-[24rem] gap-0 py-0 lg:min-h-0">
        {selected ? (
          <TruckDetails
            company={companies.find((company) => company.id === selected.transportCompanyId)}
            truck={selected}
          />
        ) : (
          <TruckOverview
            archivedCount={administrator ? archived.length : undefined}
            availableCount={available.length}
          />
        )}
      </Card>
    </div>
  )
}
