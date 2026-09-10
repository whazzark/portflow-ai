import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { BulkResourceLifecycleActions } from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import { useBulkSelection } from '@/components/lifecycle/use-bulk-selection'
import {
  useClearSelectionShortcut,
  useSelectAllShortcut,
} from '@/components/lifecycle/use-bulk-selection-shortcuts'
import { Button } from '@/components/ui/button'
import { InputSearch } from '@/components/ui/input-search'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import {
  CUSTOMER_PLURAL,
  CUSTOMER_SINGULAR,
  toBulkCustomerLifecycleOutcome,
} from '@/features/customers/customer-lifecycle'
import { customerMatchesSearch } from '@/features/customers/helpers/customer-search'
import { useCustomerMutations } from '@/features/customers/mutations/use-customer-mutations'
import { customerQueries } from '@/features/customers/queries/customer-queries'
import { CustomerSection } from '@/features/customers/ui/customer-section'
import { CustomerSheet } from '@/features/customers/ui/customer-sheet'

const customersRoute = getRouteApi('/_authenticated/customers')

export function CustomersPage() {
  const {
    search,
    status,
    availableSort,
    availableOrder,
    archivedSort,
    archivedOrder,
    customerId,
    mode,
  } = customersRoute.useSearch()
  const navigate = customersRoute.useNavigate()

  const user = useAuthenticatedUser()
  const customersQuery = useQuery(customerQueries.list())
  const mutations = useCustomerMutations()

  const selection = useBulkSelection()
  const { selectedIds: selectedCustomerIds, clear: clearSelection } = selection
  const lifecycleActionIds = useMemo(() => [...selectedCustomerIds], [selectedCustomerIds])
  const canAdminister = isAdministrator(user)
  const customers = customersQuery.data?.data ?? []
  const availableCustomers = customers.filter((customer) => customer.status === 'AVAILABLE')
  const archivedCustomers = customers.filter((customer) => customer.status === 'ARCHIVED')

  // What the active tab currently lists, once the search has narrowed it — the same set the table
  // renders, and so the same set `Select all` and Ctrl/Cmd+A act on.
  const visibleCustomers = useMemo(
    () =>
      customers
        .filter(
          (customer) => customer.status === (status === 'available' ? 'AVAILABLE' : 'ARCHIVED'),
        )
        .filter((customer) => customerMatchesSearch(customer, search)),
    [customers, search, status],
  )
  const visibleSelectedCustomerIds = useMemo(() => {
    const selectedStatus = status === 'available' ? 'AVAILABLE' : 'ARCHIVED'
    const visibleIds = new Set(
      customers.filter((customer) => customer.status === selectedStatus).map((c) => c.id),
    )

    return new Set([...selectedCustomerIds].filter((id) => visibleIds.has(id)))
  }, [customers, selectedCustomerIds, status])

  const selectAllVisible = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault()
      selection.toggleMany(
        visibleCustomers.map((customer) => customer.id),
        true,
      )
    },
    [selection, visibleCustomers],
  )
  useSelectAllShortcut({ enabled: canAdminister, onSelectAll: selectAllVisible })
  useClearSelectionShortcut({
    enabled: canAdminister && selectedCustomerIds.size > 0,
    onClear: clearSelection,
  })

  if (!customersQuery.data) {
    return null
  }
  const sheetMode =
    mode === 'create' && !canAdminister
      ? undefined
      : (mode === 'edit' || mode === 'view') && !customerId
        ? undefined
        : mode
  const sheetCustomerId = sheetMode === 'create' ? undefined : customerId

  const updateSearch = (value: string) => {
    clearSelection()
    void navigate({ search: (previous) => ({ ...previous, search: value }) })
  }

  const updateStatus = (nextStatus: string) => {
    if (nextStatus !== 'available' && nextStatus !== 'archived') {
      return
    }

    clearSelection()
    void navigate({ search: (previous) => ({ ...previous, status: nextStatus }) })
  }

  const activeCustomers = status === 'available' ? availableCustomers : archivedCustomers
  const activeSort = status === 'available' ? availableSort : archivedSort
  const activeOrder = status === 'available' ? availableOrder : archivedOrder
  const isArchived = status === 'archived'

  const updateSorting =
    (prefix: 'available' | 'archived'): OnChangeFn<SortingState> =>
    (updater) => {
      const current: SortingState = [
        {
          id: prefix === 'available' ? availableSort : archivedSort,
          desc: (prefix === 'available' ? availableOrder : archivedOrder) === 'desc',
        },
      ]
      const next = typeof updater === 'function' ? updater(current) : updater
      const sort = next[0]

      void navigate({
        search: (previous) => ({
          ...previous,
          [`${prefix}Sort`]: sort?.id ?? 'code',
          [`${prefix}Order`]: sort?.desc ? 'desc' : 'asc',
        }),
      })
    }

  return (
    <div className="relative flex flex-col gap-6 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
      <h1 className="sr-only">Customers</h1>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <InputSearch
          fieldClassName="max-w-xl"
          id="customer-search"
          label="Search customers"
          onValueChange={updateSearch}
          placeholder="Search by code, company name, or lifecycle comment"
          value={search}
        />
        {canAdminister && (
          <Button
            onClick={() =>
              navigate({
                search: (previous) => ({ ...previous, customerId: undefined, mode: 'create' }),
              })
            }
          >
            Create customer
          </Button>
        )}
      </div>

      <Tabs className="min-h-0 flex-1" onValueChange={updateStatus} value={status}>
        <TabsList aria-label="Customer status" variant="line">
          <TabsTrigger value="available">
            Available{' '}
            <span className="text-muted-foreground tabular-nums">
              ({availableCustomers.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived{' '}
            <span className="text-muted-foreground tabular-nums">({archivedCustomers.length})</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent className="min-h-0 md:overflow-hidden" value="available">
          {status === 'available' && (
            <CustomerSection
              customers={activeCustomers}
              isArchived={isArchived}
              onEdit={(customerId) =>
                navigate({ search: (previous) => ({ ...previous, customerId, mode: 'edit' }) })
              }
              onSelect={(customerId) =>
                navigate({ search: (previous) => ({ ...previous, customerId, mode: 'view' }) })
              }
              search={search}
              sorting={[{ id: activeSort, desc: activeOrder === 'desc' }]}
              onSortingChange={updateSorting(status)}
              canAdminister={canAdminister}
              selectedIds={visibleSelectedCustomerIds}
              onSelectionChange={(customerIds) => selection.retainOnly(customerIds)}
            />
          )}
        </TabsContent>
        <TabsContent className="min-h-0 md:overflow-hidden" value="archived">
          {status === 'archived' && (
            <CustomerSection
              customers={activeCustomers}
              isArchived={isArchived}
              onEdit={(customerId) =>
                navigate({ search: (previous) => ({ ...previous, customerId, mode: 'edit' }) })
              }
              onSelect={(customerId) =>
                navigate({ search: (previous) => ({ ...previous, customerId, mode: 'view' }) })
              }
              search={search}
              sorting={[{ id: activeSort, desc: activeOrder === 'desc' }]}
              onSortingChange={updateSorting(status)}
              canAdminister={canAdminister}
              selectedIds={visibleSelectedCustomerIds}
              onSelectionChange={(customerIds) => selection.retainOnly(customerIds)}
            />
          )}
        </TabsContent>
      </Tabs>
      {canAdminister && (
        <BulkResourceLifecycleActions
          action={isArchived ? 'reactivate' : 'archive'}
          idPrefix="customer"
          onClear={clearSelection}
          // Narrowed to the blocked ids rather than cleared, so the administrator can resolve the
          // blocker and retry exactly those without reselecting them.
          onSuccess={(outcome) =>
            selection.retainOnly(outcome.blocked.map((blocked) => blocked.id))
          }
          plural={CUSTOMER_PLURAL}
          refresh={mutations.refreshCustomers}
          selectedIds={lifecycleActionIds}
          singular={CUSTOMER_SINGULAR}
          submit={async ({ ids, comment }) =>
            toBulkCustomerLifecycleOutcome(
              (isArchived
                ? await mutations.reactivateMany.mutateAsync({ body: { ids, comment } })
                : await mutations.archiveMany.mutateAsync({ body: { ids, comment } })
              ).data,
            )
          }
        />
      )}
      <CustomerSheet
        canAdminister={canAdminister}
        customerId={sheetCustomerId}
        customer={
          sheetCustomerId
            ? customers.find((customer) => customer.id === sheetCustomerId)
            : undefined
        }
        mode={sheetMode}
        onChange={(next) =>
          navigate({
            search: (previous) => ({
              ...previous,
              customerId: next.customerId,
              mode: next.mode,
            }),
          })
        }
      />
    </div>
  )
}
