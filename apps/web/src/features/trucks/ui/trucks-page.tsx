import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { BulkResourceLifecycleActions } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InputSearch } from '@/components/ui/input-search'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import {
  TRUCK_BLOCKER_REASON_LABELS,
  TRUCK_PLURAL,
  TRUCK_SINGULAR,
  toBulkTruckLifecycleOutcome,
} from '@/features/trucks/truck-lifecycle'
import type { TruckDto } from '@/features/trucks/types'
import { CreateTruckPanel } from '@/features/trucks/ui/create-truck-panel'
import { EditTruckPanel } from '@/features/trucks/ui/edit-truck-panel'

import { TruckDetails } from '@/features/trucks/ui/truck-details'
import { TruckSection } from '@/features/trucks/ui/truck-section'
import { TrucksError } from '@/features/trucks/ui/trucks-error'
import { resourceSuccessMessage } from '@/helpers/resource-copy'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TrucksPage() {
  const user = useAuthenticatedUser()
  const administrator = isAdministrator(user)
  const { transportCompanyId, truckStatus, truckSearch, truckId, truckMode } =
    transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()
  // The two collections carry different DTOs — the available one withholds the lifecycle
  // actors — so they are two queries kept apart rather than one branching call.
  const allTrucksQuery = useQuery({ ...truckQueries.all(), enabled: administrator })
  const availableTrucksQuery = useQuery({ ...truckQueries.available(), enabled: !administrator })
  const trucksQuery = administrator ? allTrucksQuery : availableTrucksQuery
  // Administrators already receive suspended trucks in the complete collection, with their
  // lifecycle actors; everyone else reads them here, without.
  const suspendedTrucksQuery = useQuery({
    ...truckQueries.suspended(),
    enabled: !administrator,
  })
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const availableCompaniesQuery = useQuery(transportCompanyQueries.available())
  const companies = companiesQuery.data?.data ?? []
  const availableCompanies = availableCompaniesQuery.data?.data
  const trucks = [
    ...((trucksQuery.data?.data ?? []) as unknown as TruckDto[]),
    ...((suspendedTrucksQuery.data?.data ?? []) as unknown as TruckDto[]),
  ]
  // Creation is authoritative on the API side; gating here only keeps the interface honest, so a
  // hand-typed `truckMode=create` opens nothing for a non-administrator. Mirrors how the
  // transport-company panel next to it reads `companyDetailsMode`.
  const isCreatingTruck = truckMode === 'create' && administrator
  const truckMutations = useTruckMutations()
  const scopedTrucks = transportCompanyId
    ? trucks.filter((truck) => truck.transportCompanyId === transportCompanyId)
    : trucks
  const selected = scopedTrucks.find((truck) => truck.id === truckId)
  // A scoped directory only lists one company's trucks, so creating for another one would
  // succeed while leaving nothing visible here.
  const creatableCompanies =
    availableCompanies && transportCompanyId
      ? availableCompanies.filter((company) => company.id === transportCompanyId)
      : availableCompanies
  // Editable companies always include the truck's own current company, even if it has since
  // been archived, so the pre-filled selection is never dropped from the picker.
  const editableCompanies =
    availableCompanies && selected
      ? availableCompanies.some((company) => company.id === selected.transportCompanyId)
        ? availableCompanies
        : [
            ...availableCompanies,
            ...companies
              .filter((company) => company.id === selected.transportCompanyId)
              .map((company) => ({ id: company.id, name: company.name })),
          ]
      : availableCompanies

  // Whether editing is allowed is decided once, when an edit session starts for a given truck,
  // rather than re-derived from live query data on every render. Re-deriving it live would silently
  // discard an in-progress edit if a background refetch changes that truck's status.
  const [editSession, setEditSession] = useState<{ id: string; editable: boolean } | null>(null)

  useEffect(() => {
    if (truckMode !== 'edit' || !selected) {
      if (editSession) {
        setEditSession(null)
      }
      return
    }
    if (!editSession || editSession.id !== selected.id) {
      setEditSession({ id: selected.id, editable: selected.status === 'AVAILABLE' })
    }
  }, [editSession, selected, truckMode])

  const isEditingTruck =
    truckMode === 'edit' &&
    administrator &&
    editSession !== null &&
    editSession.id === truckId &&
    editSession.editable

  const [selectedTruckIds, setSelectedTruckIds] = useState<Set<string>>(new Set())
  const activeLifecycleStatus =
    truckStatus === 'archived'
      ? 'ARCHIVED'
      : truckStatus === 'suspended'
        ? 'SUSPENDED'
        : 'AVAILABLE'
  // Selection is offered in the available and archived tabs (archive and reactivate respectively),
  // scoped to the trucks currently listed in the active lifecycle tab and transport-company filter:
  // a truck's own lifecycle status determines which single tab lists it, so pruning by the visible
  // list also prevents a selection made in one tab from leaking into the other direction's action.
  // The suspended tab carries no bulk action, so it offers no selection at all.
  const visibleSelectedTruckIds = useMemo(() => {
    const visibleIds = new Set(
      scopedTrucks
        .filter((truck) => truck.status === activeLifecycleStatus)
        .map((truck) => truck.id),
    )

    return new Set([...selectedTruckIds].filter((id) => visibleIds.has(id)))
  }, [activeLifecycleStatus, scopedTrucks, selectedTruckIds])
  const visibleSelectedTruckIdList = useMemo(
    () => [...visibleSelectedTruckIds],
    [visibleSelectedTruckIds],
  )

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

    const selectedStatus =
      selected.status === 'ARCHIVED'
        ? 'archived'
        : selected.status === 'SUSPENDED'
          ? 'suspended'
          : 'available'
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
  const suspended = scopedTrucks.filter((truck) => truck.status === 'SUSPENDED')
  const selectedTrucks =
    truckStatus === 'suspended'
      ? suspended
      : administrator && truckStatus === 'archived'
        ? archived
        : available
  const toggleTruck = (id: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        truckId: previous.truckId === id ? undefined : id,
      }),
    })
  }
  const selectTruck = (id: string) => {
    void navigate({ search: (previous) => ({ ...previous, truckId: id }) })
  }
  // The row menu edits a truck that is not necessarily the selected one, so it carries the
  // selection and the mode in a single navigation.
  const editTruck = (id: string) => {
    void navigate({ search: (previous) => ({ ...previous, truckId: id, truckMode: 'edit' }) })
  }

  const startCreatingTruck = () => {
    void navigate({
      search: (previous) => ({ ...previous, truckId: undefined, truckMode: 'create' }),
    })
  }
  const stopCreatingTruck = () => {
    void navigate({ search: (previous) => ({ ...previous, truckMode: 'view' }) })
  }

  const directory = (
    <Card
      aria-label="Truck directory"
      className="h-[min(42rem,70svh)] min-h-[28rem] gap-0 py-0 lg:h-auto lg:min-h-0"
    >
      <CardContent className="flex min-h-0 flex-1 flex-col px-0">
        <div className="flex items-center gap-2 border-b p-3">
          <InputSearch
            fieldClassName="flex-1"
            id="truck-search"
            label="Search trucks"
            onValueChange={(value) =>
              navigate({
                replace: true,
                search: (previous) => ({ ...previous, truckSearch: value }),
              })
            }
            placeholder="Search by registration or company"
            value={truckSearch}
          />
          {administrator && (
            <Button onClick={startCreatingTruck} type="button">
              Create truck
            </Button>
          )}
        </div>
        <Tabs
          className="min-h-0 flex-1 gap-0"
          onValueChange={(value) => {
            if (
              value === 'available' ||
              value === 'suspended' ||
              (administrator && value === 'archived')
            ) {
              void navigate({
                search: (previous) => ({
                  ...previous,
                  truckId: undefined,
                  truckStatus: value,
                }),
              })
            }
          }}
          value={truckStatus}
        >
          <TabsList aria-label="Truck status" className="mx-3 mt-3" variant="line">
            <TabsTrigger value="available">
              Available{' '}
              <span className="text-muted-foreground tabular-nums">({available.length})</span>
            </TabsTrigger>
            <TabsTrigger value="suspended">
              Suspended{' '}
              <span className="text-muted-foreground tabular-nums">({suspended.length})</span>
            </TabsTrigger>
            {administrator && (
              <TabsTrigger value="archived">
                Archived{' '}
                <span className="text-muted-foreground tabular-nums">({archived.length})</span>
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent className="min-h-0" value="available">
            {truckStatus === 'available' && (
              <TruckSection
                canAdminister={administrator}
                lifecycle="available"
                onEdit={editTruck}
                onSelect={toggleTruck}
                onSelectionChange={(checked, ids) => {
                  setSelectedTruckIds((previous) => {
                    const next = new Set(previous)
                    for (const id of ids) {
                      if (checked) {
                        next.add(id)
                      } else {
                        next.delete(id)
                      }
                    }
                    return next
                  })
                }}
                onView={selectTruck}
                search={truckSearch}
                selectable={administrator}
                selectedId={truckId}
                selectedIds={visibleSelectedTruckIds}
                trucks={selectedTrucks}
                companies={companies}
              />
            )}
          </TabsContent>
          <TabsContent className="min-h-0" value="suspended">
            {truckStatus === 'suspended' && (
              <TruckSection
                canAdminister={administrator}
                lifecycle="suspended"
                onEdit={editTruck}
                onSelect={toggleTruck}
                onView={selectTruck}
                search={truckSearch}
                selectable={false}
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
                  canAdminister={administrator}
                  lifecycle="archived"
                  onEdit={editTruck}
                  onSelect={toggleTruck}
                  onSelectionChange={(checked, ids) => {
                    setSelectedTruckIds((previous) => {
                      const next = new Set(previous)
                      for (const id of ids) {
                        if (checked) {
                          next.add(id)
                        } else {
                          next.delete(id)
                        }
                      }
                      return next
                    })
                  }}
                  onView={selectTruck}
                  search={truckSearch}
                  selectable={administrator}
                  selectedId={truckId}
                  selectedIds={visibleSelectedTruckIds}
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

  const createSheet = (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          stopCreatingTruck()
        }
      }}
      open={isCreatingTruck}
    >
      <SheetContent className="overflow-hidden" size="lg">
        <CreateTruckPanel
          companies={creatableCompanies}
          companiesError={availableCompaniesQuery.isError}
          onRetryCompanies={() => void availableCompaniesQuery.refetch()}
          onCreate={async (value) => {
            const result = await truckMutations.create.mutateAsync({ body: value })

            return result.data
          }}
          onSuccess={(created) => {
            toast.success(resourceSuccessMessage('create', TRUCK_SINGULAR, created.registration))
            // One navigation, not two: leaving create mode and selecting the new truck in
            // separate calls would briefly put the URL in a state that opens neither panel.
            void navigate({
              search: (previous) => ({
                ...previous,
                truckId: created.id,
                truckMode: 'view',
              }),
            })
          }}
        />
      </SheetContent>
    </Sheet>
  )

  const startEditingTruck = () => {
    void navigate({ search: (previous) => ({ ...previous, truckMode: 'edit' }) })
  }
  const stopEditingTruck = () => {
    void navigate({ search: (previous) => ({ ...previous, truckMode: 'view' }) })
  }

  const truckDetails = selected && (
    <TruckDetails
      administrator={administrator}
      canAdminister={administrator}
      company={companies.find((company) => company.id === selected.transportCompanyId)}
      onEdit={startEditingTruck}
      truck={selected}
    />
  )

  const editTruckPanel = selected && (
    <EditTruckPanel
      key={selected.id}
      companies={editableCompanies}
      companiesError={availableCompaniesQuery.isError}
      onCancel={stopEditingTruck}
      onRetryCompanies={() => void availableCompaniesQuery.refetch()}
      onSuccess={(updated) => {
        toast.success(resourceSuccessMessage('update', TRUCK_SINGULAR, updated.registration))
        stopEditingTruck()
      }}
      onUpdate={async (value) => {
        const result = await truckMutations.update.mutateAsync({
          params: { id: selected.id },
          body: value,
        })

        return result.data
      }}
      truck={selected}
    />
  )

  // Suspension is a one-truck-at-a-time action, so the suspended tab has no bulk toolbar.
  const bulkLifecycleActions = administrator && truckStatus !== 'suspended' && (
    <BulkResourceLifecycleActions
      action={truckStatus === 'archived' ? 'reactivate' : 'archive'}
      blockerReasonLabels={TRUCK_BLOCKER_REASON_LABELS}
      idPrefix="truck"
      onClear={() => setSelectedTruckIds(new Set())}
      // Narrowed to the blocked ids rather than cleared, so the administrator can resolve the
      // blocker and retry exactly those without reselecting them.
      onSuccess={(outcome) =>
        setSelectedTruckIds(new Set(outcome.blocked.map((blocked) => blocked.id)))
      }
      plural={TRUCK_PLURAL}
      refresh={truckMutations.refreshTrucks}
      selectedIds={visibleSelectedTruckIdList}
      singular={TRUCK_SINGULAR}
      submit={async ({ ids, comment }) =>
        toBulkTruckLifecycleOutcome(
          (truckStatus === 'archived'
            ? await truckMutations.reactivateMany.mutateAsync({ body: { ids, comment } })
            : await truckMutations.archiveMany.mutateAsync({ body: { ids, comment } })
          ).data,
        )
      }
    />
  )

  return (
    <div className="relative">
      {directory}
      {createSheet}
      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            void navigate({
              search: (previous) => ({ ...previous, truckId: undefined, truckMode: 'view' }),
            })
          }
        }}
        open={Boolean(selected)}
      >
        <SheetContent className="overflow-y-auto" size="lg">
          {isEditingTruck ? editTruckPanel : truckDetails}
        </SheetContent>
      </Sheet>
      {bulkLifecycleActions}
    </div>
  )
}
