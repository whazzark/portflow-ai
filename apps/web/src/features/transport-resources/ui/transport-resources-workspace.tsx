import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { BulkResourceLifecycleActions } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import { useBulkSelection } from '@/components/lifecycle/use-bulk-selection'
import {
  useClearSelectionShortcut,
  useSelectAllShortcut,
} from '@/components/lifecycle/use-bulk-selection-shortcuts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InputSearch } from '@/components/ui/input-search'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { transportCompanyMatchesSearch } from '@/features/transport-companies/helpers/transport-company-search'
import { useTransportCompanyMutations } from '@/features/transport-companies/mutations/use-transport-company-mutations'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import {
  TRANSPORT_COMPANY_BLOCKER_REASON_LABELS,
  TRANSPORT_COMPANY_PLURAL,
  TRANSPORT_COMPANY_SINGULAR,
  toBulkTransportCompanyLifecycleOutcome,
} from '@/features/transport-companies/transport-company-lifecycle'
import { CreateTransportCompanyPanel } from '@/features/transport-companies/ui/create-transport-company-panel'
import { EditTransportCompanyPanel } from '@/features/transport-companies/ui/edit-transport-company-panel'
import { TransportCompaniesError } from '@/features/transport-companies/ui/transport-companies-error'
import { TransportCompanyDetails } from '@/features/transport-companies/ui/transport-company-details'
import { TransportCompanySection } from '@/features/transport-companies/ui/transport-company-section'
import { TrucksPage } from '@/features/trucks/ui/trucks-page'
import { resourceSuccessMessage } from '@/helpers/resource-copy'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TransportResourcesWorkspace() {
  const { companySearch, companyStatus, companyDetailsId, companyDetailsMode, transportCompanyId } =
    transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()
  const user = useAuthenticatedUser()
  const canAdminister = isAdministrator(user)
  const mutations = useTransportCompanyMutations()
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const companies = companiesQuery.data?.data ?? []
  const selectedCompany = companies.find((company) => company.id === transportCompanyId)
  const companyDetails = companies.find((company) => company.id === companyDetailsId)

  // Whether editing is allowed is decided once, when an edit session starts for a given company,
  // rather than re-derived from live query data on every render. Re-deriving it live would silently
  // discard an in-progress edit if a background refetch changes that company's status.
  const [editSession, setEditSession] = useState<{ id: string; editable: boolean } | null>(null)

  // Multi-selection is a distinct concept from `transportCompanyId`, which scopes the embedded
  // trucks panel: a row's checkbox joins this selection, a row's body still scopes the trucks
  // panel, and neither clears the other.
  const selection = useBulkSelection()
  const { selectedIds: selectedCompanyIds, clear: clearCompanySelection } = selection
  const directoryRef = useRef<HTMLDivElement>(null)

  const activeCompanyStatus = companyStatus === 'available' ? 'AVAILABLE' : 'ARCHIVED'

  // The part of the selection the active tab actually lists, as the trucks panel beside it also
  // keeps: a company's own status decides which single tab shows it, so pruning by the visible tab
  // is what keeps a selection made under one status from being counted as hidden by the search, or
  // offered to the other direction's action, once something flips the tab under it — archiving from
  // the details panel does exactly that, and no tab click is involved to clear the selection.
  const visibleSelectedCompanyIds = useMemo(() => {
    const visibleIds = new Set(
      companies
        .filter((company) => company.status === activeCompanyStatus)
        .map((company) => company.id),
    )

    return new Set([...selectedCompanyIds].filter((id) => visibleIds.has(id)))
  }, [activeCompanyStatus, companies, selectedCompanyIds])
  const visibleSelectedCompanyIdList = useMemo(
    () => [...visibleSelectedCompanyIds],
    [visibleSelectedCompanyIds],
  )

  // What the active tab currently lists, once the search has narrowed it — the same set the
  // section renders, and so the same set Ctrl/Cmd+A acts on.
  const shortcutSelectableCompanyIds = useMemo(
    () =>
      companies
        .filter((company) => company.status === activeCompanyStatus)
        .filter((company) => transportCompanyMatchesSearch(company, companySearch))
        .map((company) => company.id),
    [activeCompanyStatus, companies, companySearch],
  )

  const selectAllVisibleCompanies = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault()
      selection.toggleMany(shortcutSelectableCompanyIds, true)
    },
    [selection, shortcutSelectableCompanyIds],
  )
  // Scoped to this directory: the trucks beside it are selectable too, so only the one holding
  // focus can be what the administrator meant — for clearing a selection exactly as for building
  // one, or a single Escape would empty both collections at once. The floating toolbar this
  // directory owns sits inside the same Card, so the scope already covers it.
  useSelectAllShortcut({
    enabled: canAdminister,
    onSelectAll: selectAllVisibleCompanies,
    scopeRef: directoryRef,
  })
  useClearSelectionShortcut({
    enabled: canAdminister && selectedCompanyIds.size > 0,
    onClear: clearCompanySelection,
    scopeRef: directoryRef,
  })

  useEffect(() => {
    if (companyDetailsMode !== 'edit' || !companyDetails) {
      if (editSession) {
        setEditSession(null)
      }
      return
    }
    if (!editSession || editSession.id !== companyDetails.id) {
      setEditSession({ id: companyDetails.id, editable: companyDetails.status === 'AVAILABLE' })
    }
  }, [companyDetails, companyDetailsMode, editSession])

  const isEditingDetails =
    companyDetailsMode === 'edit' &&
    canAdminister &&
    editSession !== null &&
    editSession.id === companyDetailsId &&
    editSession.editable

  // Creation is authoritative on the API side; gating here only keeps the interface honest, so a
  // hand-typed `companyDetailsMode=create` opens nothing for a non-administrator.
  const isCreatingCompany = companyDetailsMode === 'create' && canAdminister

  useEffect(() => {
    if (transportCompanyId && companiesQuery.data && !selectedCompany) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, transportCompanyId: undefined, truckId: undefined }),
      })
    }
  }, [companiesQuery.data, navigate, selectedCompany, transportCompanyId])

  useEffect(() => {
    if (companyDetailsId && companiesQuery.data && !companyDetails) {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          companyDetailsId: undefined,
          companyDetailsMode: 'view',
        }),
      })
    }
  }, [companiesQuery.data, companyDetails, companyDetailsId, navigate])

  if (companiesQuery.isError) {
    return <TransportCompaniesError onRetry={() => companiesQuery.refetch()} />
  }

  if (!companiesQuery.data) {
    return (
      <div
        aria-label="Loading transport companies"
        className="flex min-h-0 flex-1 flex-col gap-4"
        role="status"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="min-h-56 w-full flex-1" />
      </div>
    )
  }

  const available = companies.filter((company) => company.status === 'AVAILABLE')
  const archived = companies.filter((company) => company.status === 'ARCHIVED')
  const selectedCompanies = companyStatus === 'available' ? available : archived

  const toggleCompanySelection = selection.toggle
  const toggleVisibleCompanySelection = selection.toggleMany

  const toggleCompany = (id: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        transportCompanyId: previous.transportCompanyId === id ? undefined : id,
        truckId: undefined,
      }),
    })
  }

  const viewCompanyDetails = (id: string) => {
    void navigate({
      search: (previous) => ({ ...previous, companyDetailsId: id, companyDetailsMode: 'view' }),
    })
  }

  const editCompanyDetails = (id: string) => {
    void navigate({
      search: (previous) => ({ ...previous, companyDetailsId: id, companyDetailsMode: 'edit' }),
    })
  }

  const startCompanyCreation = () => {
    void navigate({
      search: (previous) => ({
        ...previous,
        companyDetailsId: undefined,
        companyDetailsMode: 'create',
      }),
    })
  }

  const closeCompanySheet = () => {
    void navigate({
      search: (previous) => ({
        ...previous,
        companyDetailsId: undefined,
        companyDetailsMode: 'view',
      }),
    })
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:h-full lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] lg:overflow-hidden">
      <Card
        aria-label="Transport company directory"
        className="relative min-h-[28rem] gap-0 py-0 lg:min-h-0"
        ref={directoryRef}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <div className="border-b p-3">
            <InputSearch
              id="transport-company-search"
              label="Search transport companies"
              onValueChange={(value) =>
                navigate({
                  replace: true,
                  search: (previous) => ({ ...previous, companySearch: value }),
                })
              }
              placeholder="Search transport companies"
              value={companySearch}
            />
            {canAdminister && (
              <Button className="mt-3 w-full" onClick={startCompanyCreation}>
                Create transport company
              </Button>
            )}
          </div>

          <Tabs
            className="min-h-0 flex-1 gap-0"
            onValueChange={(value) => {
              if (value === 'available' || value === 'archived') {
                clearCompanySelection()
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    companyStatus: value,
                    transportCompanyId: undefined,
                    truckId: undefined,
                  }),
                })
              }
            }}
            value={companyStatus}
          >
            <TabsList aria-label="Transport company status" className="mx-3 mt-3" variant="line">
              <TabsTrigger value="available">
                Available{' '}
                <span className="text-muted-foreground tabular-nums">({available.length})</span>
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived{' '}
                <span className="text-muted-foreground tabular-nums">({archived.length})</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent className="min-h-0" value="available">
              {companyStatus === 'available' && (
                <TransportCompanySection
                  canAdminister={canAdminister}
                  companies={selectedCompanies}
                  lifecycle="available"
                  onCreate={startCompanyCreation}
                  onEdit={editCompanyDetails}
                  onSelect={toggleCompany}
                  onToggleSelection={canAdminister ? toggleCompanySelection : undefined}
                  onToggleVisible={canAdminister ? toggleVisibleCompanySelection : undefined}
                  onView={viewCompanyDetails}
                  search={companySearch}
                  selectedId={transportCompanyId}
                  selectedIds={canAdminister ? visibleSelectedCompanyIds : undefined}
                />
              )}
            </TabsContent>
            <TabsContent className="min-h-0" value="archived">
              {companyStatus === 'archived' && (
                <TransportCompanySection
                  canAdminister={canAdminister}
                  companies={selectedCompanies}
                  lifecycle="archived"
                  onEdit={editCompanyDetails}
                  onSelect={toggleCompany}
                  onToggleSelection={canAdminister ? toggleCompanySelection : undefined}
                  onToggleVisible={canAdminister ? toggleVisibleCompanySelection : undefined}
                  onView={viewCompanyDetails}
                  search={companySearch}
                  selectedId={transportCompanyId}
                  selectedIds={canAdminister ? visibleSelectedCompanyIds : undefined}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        {canAdminister && (
          <BulkResourceLifecycleActions
            action={companyStatus === 'available' ? 'archive' : 'reactivate'}
            blockerReasonLabels={TRANSPORT_COMPANY_BLOCKER_REASON_LABELS}
            idPrefix="transport-company"
            // The same set the section renders, so the toolbar can say how much of the selection
            // the current search has taken off screen — as the truck directory beside it does.
            listedIds={shortcutSelectableCompanyIds}
            onClear={clearCompanySelection}
            // Narrowed to the blocked ids rather than cleared, so the administrator can resolve
            // the blocker and retry exactly those without reselecting them.
            onSuccess={(outcome) =>
              selection.retainOnly(outcome.blocked.map((blocked) => blocked.id))
            }
            plural={TRANSPORT_COMPANY_PLURAL}
            refresh={mutations.refreshTransportCompanies}
            selectedIds={visibleSelectedCompanyIdList}
            singular={TRANSPORT_COMPANY_SINGULAR}
            submit={async ({ ids, comment }) =>
              toBulkTransportCompanyLifecycleOutcome(
                (companyStatus === 'available'
                  ? await mutations.archiveMany.mutateAsync({ body: { ids, comment } })
                  : await mutations.reactivateMany.mutateAsync({ body: { ids, comment } })
                ).data,
              )
            }
          />
        )}
      </Card>

      <TrucksPage />

      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            closeCompanySheet()
          }
        }}
        open={Boolean(companyDetails) || isCreatingCompany}
      >
        {/* No `aria-label`: each panel below renders its own `SheetTitle`, which names the
            dialog through `aria-labelledby` and would silently override one set here. */}
        <SheetContent className="overflow-y-auto" size="lg">
          {isCreatingCompany ? (
            <CreateTransportCompanyPanel
              onCreate={async (value) => {
                const result = await mutations.create.mutateAsync({ body: value })

                return result.data
              }}
              onSuccess={(created) => {
                toast.success(
                  resourceSuccessMessage('create', TRANSPORT_COMPANY_SINGULAR, created.name),
                )
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    // A company is always created available, so land on the tab that actually
                    // shows it — otherwise a success toast appears over an unchanged list.
                    companyStatus: 'available',
                    companyDetailsId: created.id,
                    companyDetailsMode: 'view',
                    // Changing tab always clears the selection, so do it here too: otherwise the
                    // trucks panel stays scoped to a company the Available tab no longer lists.
                    transportCompanyId: undefined,
                    truckId: undefined,
                  }),
                })
              }}
            />
          ) : companyDetails && isEditingDetails ? (
            <EditTransportCompanyPanel
              company={companyDetails}
              onCancel={() =>
                void navigate({
                  search: (previous) => ({ ...previous, companyDetailsMode: 'view' }),
                })
              }
              onSuccess={(updated) => {
                toast.success(
                  resourceSuccessMessage('update', TRANSPORT_COMPANY_SINGULAR, updated.name),
                )
                void navigate({
                  search: (previous) => ({ ...previous, companyDetailsMode: 'view' }),
                })
              }}
              onUpdate={async (value) => {
                const result = await mutations.update.mutateAsync({
                  params: { id: companyDetails.id },
                  body: value,
                })

                return result.data
              }}
            />
          ) : companyDetails ? (
            <TransportCompanyDetails
              canAdminister={canAdminister}
              company={companyDetails}
              onLifecycleSuccess={() =>
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    companyStatus: companyDetails.status === 'ARCHIVED' ? 'available' : 'archived',
                    transportCompanyId: undefined,
                    truckId: undefined,
                  }),
                })
              }
              onEdit={() =>
                void navigate({
                  search: (previous) => ({ ...previous, companyDetailsMode: 'edit' }),
                })
              }
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
