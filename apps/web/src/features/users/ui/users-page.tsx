import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { FilterIcon } from 'lucide-react'
import { InputSearch } from '@/components/ui/input-search'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import {
  statusViewEmptyTitle,
  statusViewLabel,
  statusViewTableLabel,
  toAccessStatus,
  USER_ROLE_LABELS,
  USER_STATUS_VIEWS,
  type UserStatusView,
} from '@/features/users/helpers/user-labels'
import {
  compareUsers,
  type UserRoleFilter,
  userMatchesRole,
  userMatchesSearch,
} from '@/features/users/helpers/user-search'
import { userQueries } from '@/features/users/queries/user-queries'
import { UserSheet } from '@/features/users/ui/user-sheet'
import { UserTable } from '@/features/users/ui/user-table'

const usersRoute = getRouteApi('/_authenticated/users')

const ROLE_FILTER_OPTIONS = [
  { label: 'All roles', value: 'all' },
  ...Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ label, value })),
]

export function UsersPage() {
  const { search, status, role, sort, order, userId } = usersRoute.useSearch()
  const navigate = usersRoute.useNavigate()
  const viewer = useAuthenticatedUser()
  const usersQuery = useQuery(userQueries.list())

  if (!usersQuery.data) {
    return null
  }

  const users = usersQuery.data.data
  // An operations admin consults the active set and nothing else, so no status view is offered:
  // an empty "Pending" or "Deactivated" tab would itself disclose a collection they may not read.
  const consultsEveryStatus = viewer.role === 'ORGANIZATION_ADMIN'
  const sorting: SortingState = [{ id: sort, desc: order === 'desc' }]

  // The status view partitions the collection; the search and the role filter then narrow what is
  // visible inside it. All three apply to the collection already retrieved — never a new request.
  const usersOf = (view: UserStatusView) =>
    users
      .filter((user) => user.accessStatus === toAccessStatus(view))
      .filter((user) => userMatchesSearch(user, search))
      .filter((user) => userMatchesRole(user, role))
      .sort((left, right) => {
        const comparison = compareUsers(left, right, sort)

        return order === 'desc' ? -comparison : comparison
      })

  const countOf = (view: UserStatusView) =>
    users.filter((user) => user.accessStatus === toAccessStatus(view)).length

  // The record is a view over the collection already retrieved, so it follows every refresh and
  // closes as soon as its user leaves the visible view.
  const visibleUsers = usersOf(consultsEveryStatus ? status : 'active')
  const openUser = userId ? visibleUsers.find((user) => user.id === userId) : undefined
  const openUserId = openUser ? userId : undefined

  const openRecord = (nextUserId: string) =>
    void navigate({ search: (previous) => ({ ...previous, userId: nextUserId }) })

  const closeRecord = () =>
    void navigate({ search: (previous) => ({ ...previous, userId: undefined }) })

  const updateSearch = (value: string) =>
    void navigate({ search: (previous) => ({ ...previous, search: value }) })

  const updateRole = (value: string | null) => {
    if (value === null) {
      return
    }

    void navigate({ search: (previous) => ({ ...previous, role: value as UserRoleFilter }) })
  }

  const clearFilters = () =>
    void navigate({ search: (previous) => ({ ...previous, search: '', role: 'all' }) })

  const updateStatus = (nextStatus: string) => {
    if (!USER_STATUS_VIEWS.includes(nextStatus as UserStatusView)) {
      return
    }

    void navigate({ search: (previous) => ({ ...previous, status: nextStatus as UserStatusView }) })
  }

  const updateSorting: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const nextSort = next[0]

    void navigate({
      search: (previous) => ({
        ...previous,
        sort: nextSort?.id === 'role' ? 'role' : 'name',
        order: nextSort?.desc ? 'desc' : 'asc',
      }),
    })
  }

  const tableFor = (view: UserStatusView) => (
    <UserTable
      emptyDescription="No user holds this access status yet."
      emptyTitle={statusViewEmptyTitle(view)}
      onClearFilters={clearFilters}
      onSelect={openRecord}
      onSortingChange={updateSorting}
      search={search}
      sorting={sorting}
      totalInView={countOf(view)}
      users={usersOf(view)}
      view={view}
    />
  )

  return (
    <main className="relative flex flex-col gap-6 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
      <h1 className="sr-only">Users</h1>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <InputSearch
          fieldClassName="max-w-xl md:flex-1"
          id="user-search"
          label="Search users"
          onValueChange={updateSearch}
          placeholder="Search by first name, last name, or email"
          value={search}
        />
        <Select items={ROLE_FILTER_OPTIONS} onValueChange={updateRole} value={role}>
          <SelectTrigger
            aria-label="Filter by role"
            className="text-muted-foreground data-[filtered=true]:text-foreground"
            data-filtered={role !== 'all'}
            id="user-role-filter"
            size="sm"
          >
            <FilterIcon aria-hidden="true" />
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ROLE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {consultsEveryStatus ? (
        <Tabs className="min-h-0 flex-1" onValueChange={updateStatus} value={status}>
          <TabsList aria-label="User access status" variant="line">
            {USER_STATUS_VIEWS.map((view) => (
              <TabsTrigger key={view} value={view}>
                {statusViewLabel(view)}{' '}
                <span className="text-muted-foreground tabular-nums">({countOf(view)})</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {USER_STATUS_VIEWS.map((view) => (
            <TabsContent className="min-h-0 md:overflow-hidden" key={view} value={view}>
              {status === view && tableFor(view)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col gap-4">
          <h2 className="font-medium text-sm">
            {statusViewTableLabel('active')}{' '}
            <span className="text-muted-foreground tabular-nums">({countOf('active')})</span>
          </h2>
          {tableFor('active')}
        </section>
      )}

      <UserSheet onClose={closeRecord} user={openUser} userId={openUserId} />
    </main>
  )
}
