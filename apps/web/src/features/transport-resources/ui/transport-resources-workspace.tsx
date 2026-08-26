import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { BulkResourceLifecycleActions } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
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
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set())

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
      <main aria-label="Loading transport companies" className="flex min-h-0 flex-1 flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="min-h-56 w-full flex-1" />
      </main>
    )
  }

  const available = companies.filter((company) => company.status === 'AVAILABLE')
  const archived = companies.filter((company) => company.status === 'ARCHIVED')
  const selectedCompanies = companyStatus === 'available' ? available : archived

  const toggleCompanySelection = (id: string) => {
    setSelectedCompanyIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleVisibleCompanySelection = (ids: string[], select: boolean) => {
    setSelectedCompanyIds((previous) => {
      const next = new Set(previous)
      for (const id of ids) {
        if (select) {
          next.add(id)
        } else {
          next.delete(id)
        }
      }
      return next
    })
  }

  const clearCompanySelection = () => {
    setSelectedCompanyIds(new Set())
  }

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
      >
        <CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <div className="border-b p-3">
            <Field>
              <FieldLabel className="sr-only" htmlFor="transport-company-search">
                Search transport companies
              </FieldLabel>
              <div className="relative">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-9"
                  id="transport-company-search"
                  onChange={(event) =>
                    navigate({
                      replace: true,
                      search: (previous) => ({ ...previous, companySearch: event.target.value }),
                    })
                  }
                  placeholder="Search transport companies"
                  value={companySearch}
                />
              </div>
            </Field>
            {canAdminister && (
              <Button className="mt-3 w-full" onClick={startCompanyCreation}>
                <PlusIcon aria-hidden="true" />
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
                  selectedIds={canAdminister ? selectedCompanyIds : undefined}
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
                  selectedIds={canAdminister ? selectedCompanyIds : undefined}
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
            onClear={clearCompanySelection}
            // Narrowed to the blocked ids rather than cleared, so the administrator can resolve
            // the blocker and retry exactly those without reselecting them.
            onSuccess={(outcome) =>
              setSelectedCompanyIds(new Set(outcome.blocked.map((blocked) => blocked.id)))
            }
            plural={TRANSPORT_COMPANY_PLURAL}
            refresh={mutations.refreshTransportCompanies}
            selectedIds={[...selectedCompanyIds]}
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
        <SheetContent
          aria-label={isCreatingCompany ? 'Create transport company' : 'Transport company details'}
          className="overflow-y-auto"
        >
          {isCreatingCompany ? (
            <CreateTransportCompanyPanel
              onCreate={async (value) => {
                const result = await mutations.create.mutateAsync({ body: value })

                return result.data
              }}
              onSuccess={(created) => {
                toast.success('Transport company created')
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
              onSuccess={() => {
                toast.success('Transport company updated')
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
