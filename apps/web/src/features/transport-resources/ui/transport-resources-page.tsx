import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronUpIcon, TruckIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ResourceCollectionError } from '@/components/resource/resource-feedback'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { buildFleetView } from '@/features/transport-resources/helpers/fleet-view'
import type { FleetSort } from '@/features/transport-resources/helpers/transport-resources-search'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import type { TruckDto } from '@/features/trucks/types'
import { CompanyGroupActions } from './company-group-actions'
import { CompanyGroupHeader } from './company-group-rows'
import { ArchivedNotice, CompanyFilterBanner, FleetNoMatch } from './fleet-banners'
import { CompanyDetailRow, TruckDetailRow } from './fleet-detail-rows'
import { FleetTable } from './fleet-table'
import { FleetToolbar } from './fleet-toolbar'
import { TruckRow, truckViewButtonId } from './truck-row'
import { TruckRowActions } from './truck-row-actions'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TransportResourcesPage() {
  const user = useAuthenticatedUser()
  const administrator = isAdministrator(user)
  const search = transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()

  // The complete collection, with archived trucks and lifecycle actors, is the administrators'.
  // Everyone else reads the available and suspended collections, which withhold the actors.
  const allTrucksQuery = useQuery({ ...truckQueries.all(), enabled: administrator })
  const availableTrucksQuery = useQuery({ ...truckQueries.available(), enabled: !administrator })
  const suspendedTrucksQuery = useQuery({ ...truckQueries.suspended(), enabled: !administrator })
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const collectionQueries = administrator
    ? [allTrucksQuery, companiesQuery]
    : [availableTrucksQuery, suspendedTrucksQuery, companiesQuery]

  const trucks = useMemo(
    () =>
      administrator
        ? (allTrucksQuery.data?.data ?? [])
        : ([
            ...(availableTrucksQuery.data?.data ?? []),
            ...(suspendedTrucksQuery.data?.data ?? []),
          ] as unknown as TruckDto[]),
    [administrator, allTrucksQuery.data, availableTrucksQuery.data, suspendedTrucksQuery.data],
  )
  const companies = companiesQuery.data?.data

  const view = useMemo(
    () =>
      buildFleetView({
        companies: companies ?? [],
        trucks,
        statuses: search.status,
        search: search.search,
        transportCompanyId: search.transportCompanyId,
        sort: search.sort,
        order: search.order,
        administrator,
      }),
    [administrator, companies, search, trucks],
  )

  // Collapsing a group is a momentary reading aid, not a view anyone shares.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  // Creating and editing are the administrators'; a hand-typed mode opens nothing for anyone else.
  useEffect(() => {
    if (!administrator && (search.truckMode !== 'view' || search.companyDetailsMode !== 'view')) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, truckMode: 'view', companyDetailsMode: 'view' }),
      })
    }
  }, [administrator, navigate, search.companyDetailsMode, search.truckMode])

  // A record that is not (or no longer) in the collection opens nothing, and leaves the address.
  const trucksLoaded = collectionQueries.every((query) => query.data)
  useEffect(() => {
    if (!trucksLoaded || !companies) {
      return
    }
    const unknownTruck = search.truckId && !trucks.some((truck) => truck.id === search.truckId)
    const unknownCompany =
      search.companyDetailsId &&
      !companies.some((company) => company.id === search.companyDetailsId)
    if (unknownTruck || unknownCompany) {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          truckId: unknownTruck ? undefined : previous.truckId,
          truckMode: unknownTruck ? 'view' : previous.truckMode,
          companyDetailsId: unknownCompany ? undefined : previous.companyDetailsId,
          companyDetailsMode: unknownCompany ? 'view' : previous.companyDetailsMode,
        }),
      })
    }
  }, [companies, navigate, search.companyDetailsId, search.truckId, trucks, trucksLoaded])

  if (collectionQueries.some((query) => query.isError)) {
    return (
      <div className="p-4 md:px-8 md:py-6">
        <ResourceCollectionError
          label="transport resources"
          onRetry={() => {
            for (const query of collectionQueries) {
              if (query.isError) {
                void query.refetch()
              }
            }
          }}
          render="div"
        />
      </div>
    )
  }

  if (!companies || collectionQueries.some((query) => !query.data)) {
    return (
      <div
        aria-label="Loading transport resources"
        className="flex flex-col gap-4 p-4 md:px-8 md:py-6"
        role="status"
      >
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const setSearch = (value: string) =>
    navigate({ replace: true, search: (previous) => ({ ...previous, search: value }) })
  const sortBy = (sort: FleetSort) =>
    navigate({
      search: (previous) => ({
        ...previous,
        sort,
        order: previous.sort === sort && previous.order === 'asc' ? 'desc' : 'asc',
      }),
    })
  const showOnly = (transportCompanyId: string | undefined) =>
    navigate({ search: (previous) => ({ ...previous, transportCompanyId }) })
  const viewTruck = (truckId: string) =>
    navigate({
      search: (previous) => ({
        ...previous,
        truckId: previous.truckId === truckId ? undefined : truckId,
        truckMode: 'view',
      }),
    })
  const closeTruck = (truckId: string) =>
    navigate({
      search: (previous) => ({ ...previous, truckId: undefined, truckMode: 'view' }),
    }).then(() => document.getElementById(truckViewButtonId(truckId))?.focus())
  const closeCompany = () =>
    navigate({
      search: (previous) => ({
        ...previous,
        companyDetailsId: undefined,
        companyDetailsMode: 'view',
      }),
    })
  const editTruck = (truckId: string) =>
    navigate({ search: (previous) => ({ ...previous, truckId, truckMode: 'edit' }) })
  const viewCompany = (companyId: string) =>
    navigate({
      search: (previous) => ({
        ...previous,
        truckId: undefined,
        companyDetailsId: companyId,
        companyDetailsMode: 'view',
      }),
    })
  const editCompany = (companyId: string) =>
    navigate({
      search: (previous) => ({
        ...previous,
        truckId: undefined,
        truckMode: 'view',
        companyDetailsId: companyId,
        companyDetailsMode: 'edit',
      }),
    })
  const addTruck = (companyId: string) =>
    navigate({
      search: (previous) => ({
        ...previous,
        truckMode: 'create',
        truckCompanyId: companyId,
        companyDetailsMode: 'view',
      }),
    })
  const toggleGroup = (companyId: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (!next.delete(companyId)) {
        next.add(companyId)
      }
      return next
    })

  const fleetIsEmpty = companies.length === 0 && trucks.length === 0

  return (
    <div className="flex flex-col gap-4 p-4 md:px-8 md:py-6">
      <FleetToolbar
        counts={view.counts}
        onSearchChange={setSearch}
        onStatusesChange={(status) => navigate({ search: (previous) => ({ ...previous, status }) })}
        search={search.search}
        statuses={search.status}
      />
      {view.filteredCompany && (
        <CompanyFilterBanner
          companyName={view.filteredCompany.name}
          hiddenCompanyCount={view.hiddenCompanyCount}
          onShowAll={() => void showOnly(undefined)}
        />
      )}
      {view.showArchivedNotice && <ArchivedNotice />}
      {fleetIsEmpty ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TruckIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No transport resources yet</EmptyTitle>
            <EmptyDescription>
              Transport companies and their trucks appear here once they are created.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <FleetTable
          emptyContent={
            search.search ? (
              <FleetNoMatch
                archivedIncluded={search.status.includes('archived')}
                onClearSearch={() => void setSearch('')}
                onIncludeArchived={() =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      status: [...previous.status, 'archived'],
                    }),
                  })
                }
                search={search.search}
              />
            ) : (
              <p className="py-10 text-center text-muted-foreground text-sm">
                No truck in the selected statuses.
              </p>
            )
          }
          groups={view.groups}
          isCollapsed={(companyId) => collapsed.has(companyId)}
          onSort={(sort) => void sortBy(sort)}
          order={search.order}
          renderGroupHeader={(group) => (
            <CompanyGroupHeader
              actions={
                administrator && (
                  <CompanyGroupActions
                    group={group}
                    onAddTruck={() => void addTruck(group.company.id)}
                    onEdit={() => void editCompany(group.company.id)}
                    onViewDetails={() => void viewCompany(group.company.id)}
                  />
                )
              }
              expanded={!collapsed.has(group.company.id)}
              group={group}
              onShowOnly={() => void showOnly(group.company.id)}
              onToggle={() => toggleGroup(group.company.id)}
            />
          )}
          renderGroupDetail={(group) =>
            search.companyDetailsId === group.company.id &&
            search.companyDetailsMode === 'view' && (
              <CompanyDetailRow
                administrator={administrator}
                group={group}
                onClose={() => void closeCompany()}
                onEdit={() => void editCompany(group.company.id)}
              />
            )
          }
          renderTruck={(fleetTruck, group) => {
            const { truck } = fleetTruck
            const open = search.truckId === truck.id && search.truckMode === 'view'

            return (
              <>
                <TruckRow
                  actions={
                    open ? (
                      <Button
                        aria-expanded={true}
                        aria-label={`Hide details for ${truck.registration}`}
                        onClick={() => void closeTruck(truck.id)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ChevronUpIcon aria-hidden="true" />
                      </Button>
                    ) : (
                      administrator && (
                        <TruckRowActions
                          fleetTruck={fleetTruck}
                          onEdit={() => void editTruck(truck.id)}
                          onView={() => void viewTruck(truck.id)}
                        />
                      )
                    )
                  }
                  expanded={open}
                  fleetTruck={fleetTruck}
                  onView={() => void viewTruck(truck.id)}
                />
                {open && (
                  <TruckDetailRow
                    administrator={administrator}
                    fleetTruck={fleetTruck}
                    group={group}
                    onClose={() => void closeTruck(truck.id)}
                    onEdit={() => void editTruck(truck.id)}
                  />
                )}
              </>
            )
          }}
          sort={search.sort}
        />
      )}
    </div>
  )
}
