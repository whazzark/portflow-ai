import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import type { BulkTruckLifecycleBlocker, TruckDto } from '@/features/trucks/types'
import { CreateTruckPanel } from '@/features/trucks/ui/create-truck-panel'
import { EditTruckPanel } from '@/features/trucks/ui/edit-truck-panel'
import { TruckBulkLifecycleActions } from '@/features/trucks/ui/truck-bulk-lifecycle-actions'
import { TruckDetails } from '@/features/trucks/ui/truck-details'
import { TruckSection } from '@/features/trucks/ui/truck-section'
import { TrucksError } from '@/features/trucks/ui/trucks-error'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TrucksPage() {
  const user = useAuthenticatedUser()
  const administrator = isAdministrator(user)
  const { transportCompanyId, truckStatus, truckSearch, truckId, truckMode } =
    transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()
  const trucksQuery = useQuery(administrator ? truckQueries.all() : truckQueries.available())
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const availableCompaniesQuery = useQuery(transportCompanyQueries.available())
  const companies = companiesQuery.data?.data ?? []
  const availableCompanies = availableCompaniesQuery.data?.data
  const trucks = (trucksQuery.data?.data ?? []) as TruckDto[]
  const [isCreateOpen, setIsCreateOpen] = useState(false)
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
  const [blockedTrucks, setBlockedTrucks] = useState<BulkTruckLifecycleBlocker[]>([])
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
  const lifecycleActionIds = useMemo(
    () =>
      blockedTrucks.length > 0
        ? blockedTrucks.map((blocked) => blocked.id)
        : visibleSelectedTruckIdList,
    [blockedTrucks, visibleSelectedTruckIdList],
  )

  // The retry set from a previous outcome is meaningful only for the direction (archive or
  // reactivate) it came from, so leaving the tab it was reported in clears it — the same reason
  // switching tabs already prunes the selection itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: truckStatus is the trigger, not a value read by the effect body.
  useEffect(() => {
    setBlockedTrucks([])
  }, [truckStatus])

  useEffect(() => {
    if (!administrator && (truckStatus === 'archived' || truckStatus === 'suspended')) {
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
  const suspended = administrator
    ? scopedTrucks.filter((truck) => truck.status === 'SUSPENDED')
    : []
  const selectedTrucks = !administrator
    ? available
    : truckStatus === 'archived'
      ? archived
      : truckStatus === 'suspended'
        ? suspended
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

  const directory = (
    <Card
      aria-label="Truck directory"
      className="h-[min(42rem,70svh)] min-h-[28rem] gap-0 py-0 lg:h-auto lg:min-h-0"
    >
      <CardContent className="flex min-h-0 flex-1 flex-col px-0">
        <div className="flex items-center gap-2 border-b p-3">
          <Field className="flex-1">
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
          {administrator && (
            <Button onClick={() => setIsCreateOpen(true)} type="button">
              Create truck
            </Button>
          )}
        </div>
        <Tabs
          className="min-h-0 flex-1 gap-0"
          onValueChange={(value) => {
            if (
              value === 'available' ||
              (administrator && (value === 'archived' || value === 'suspended'))
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
          value={administrator ? truckStatus : 'available'}
        >
          <TabsList aria-label="Truck status" className="mx-3 mt-3" variant="line">
            <TabsTrigger value="available">
              Available{' '}
              <span className="text-muted-foreground tabular-nums">({available.length})</span>
            </TabsTrigger>
            {administrator && (
              <TabsTrigger value="suspended">
                Suspended{' '}
                <span className="text-muted-foreground tabular-nums">({suspended.length})</span>
              </TabsTrigger>
            )}
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
                  setBlockedTrucks([])
                }}
                search={truckSearch}
                selectable={administrator}
                selectedId={truckId}
                selectedIds={visibleSelectedTruckIds}
                trucks={selectedTrucks}
                companies={companies}
              />
            )}
          </TabsContent>
          {administrator && (
            <TabsContent className="min-h-0" value="suspended">
              {truckStatus === 'suspended' && (
                <TruckSection
                  lifecycle="suspended"
                  onSelect={toggleTruck}
                  search={truckSearch}
                  selectable={false}
                  selectedId={truckId}
                  trucks={selectedTrucks}
                  companies={companies}
                />
              )}
            </TabsContent>
          )}
          {administrator && (
            <TabsContent className="min-h-0" value="archived">
              {truckStatus === 'archived' && (
                <TruckSection
                  lifecycle="archived"
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
                    setBlockedTrucks([])
                  }}
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
    <Sheet onOpenChange={setIsCreateOpen} open={isCreateOpen}>
      <SheetContent className="overflow-hidden sm:max-w-lg">
        <CreateTruckPanel
          companies={creatableCompanies}
          companiesError={availableCompaniesQuery.isError}
          onRetryCompanies={() => void availableCompaniesQuery.refetch()}
          onCreate={async (value) => {
            const result = await truckMutations.create.mutateAsync({ body: value })

            return result.data
          }}
          onSuccess={(created) => {
            toast.success('Truck created')
            setIsCreateOpen(false)
            selectTruck(created.id)
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
      onSuccess={() => {
        toast.success('Truck updated')
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
    <TruckBulkLifecycleActions
      blockedTrucks={blockedTrucks}
      isArchived={truckStatus === 'archived'}
      onClear={() => {
        setSelectedTruckIds(new Set())
        setBlockedTrucks([])
      }}
      onSuccess={(result) => {
        setSelectedTruckIds(new Set())
        setBlockedTrucks(result.blockedTrucks)
      }}
      selectedIds={lifecycleActionIds}
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
        <SheetContent aria-label="Truck details" className="overflow-y-auto">
          {isEditingTruck ? editTruckPanel : truckDetails}
        </SheetContent>
      </Sheet>
      {bulkLifecycleActions}
    </div>
  )
}
