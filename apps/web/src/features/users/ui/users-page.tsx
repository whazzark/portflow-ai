import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { FilterIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InputSearch } from '@/components/ui/input-search'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
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
import { useUserMutations } from '@/features/users/mutations/use-user-mutations'
import { userQueries } from '@/features/users/queries/user-queries'
import type { ActivationLinkDto } from '@/features/users/types'
import { ActivationLinkDialog } from '@/features/users/ui/activation-link-dialog'
import { InviteUserPanel } from '@/features/users/ui/invite-user-panel'
import { UserSheet } from '@/features/users/ui/user-sheet'
import { UserTable } from '@/features/users/ui/user-table'

const usersRoute = getRouteApi('/_authenticated/users')

const ROLE_FILTER_OPTIONS = [
  { label: 'All roles', value: 'all' },
  ...Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ label, value })),
]

export function UsersPage() {
  const { search, status, role, sort, order, userId, mode, invitedUserId } = usersRoute.useSearch()
  const navigate = usersRoute.useNavigate()
  const viewer = useAuthenticatedUser()
  const usersQuery = useQuery(userQueries.list())
  const mutations = useUserMutations()
  // The one piece of in-progress state deliberately kept out of the URL: the activation link is a
  // secret with a single read, and the address bar is neither private nor ephemeral. Losing it on a
  // reload is the behaviour, not an accident — the panel then says so.
  const [issuedActivationLink, setIssuedActivationLink] = useState<ActivationLinkDto | undefined>(
    undefined,
  )

  const users = usersQuery.data?.data ?? []
  // An operations admin consults the active set and nothing else, so no status view is offered:
  // an empty "Pending" or "Deactivated" tab would itself disclose a collection they may not read.
  const consultsEveryStatus = viewer.role === 'ORGANIZATION_ADMIN'
  // Granting access is an organization admin's alone. The interface stays honest by not offering it
  // to anyone else; the API refuses it whatever the interface does.
  const canInvite = viewer.role === 'ORGANIZATION_ADMIN'
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

  const isInviting = canInvite && mode === 'create'
  // The outcome replaces the form rather than sitting next to it: one invitation, one surface at a
  // time. A link still held is shown whatever the mode: the access it grants already exists, so an
  // invitation left while in flight must still surface its secret, which has no second read.
  const isShowingActivationLink =
    canInvite && Boolean(invitedUserId) && (mode === 'create' || Boolean(issuedActivationLink))
  const invitedUser = invitedUserId
    ? users.find((candidate) => candidate.id === invitedUserId)
    : undefined

  const openInvitation = () =>
    void navigate({
      search: (previous) => ({
        ...previous,
        userId: undefined,
        invitedUserId: undefined,
        mode: 'create',
      }),
    })

  // Leaving the outcome is what ends the invitation: the pending view is where the new user now
  // lives, and their record is left closed.
  const closeInvitation = (nextStatus?: UserStatusView) => {
    setIssuedActivationLink(undefined)
    void navigate({
      search: (previous) => ({
        ...previous,
        mode: undefined,
        status: nextStatus ?? previous.status,
      }),
    })
  }

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

  // A userId naming no visible user is dropped from the URL rather than merely ignored: left in
  // place, it would reopen the record on its own as soon as a status change or a cleared filter
  // brought its user back into view.
  useEffect(() => {
    if (userId && usersQuery.data && !openUser) {
      void navigate({ replace: true, search: (previous) => ({ ...previous, userId: undefined }) })
    }
  }, [navigate, openUser, userId, usersQuery.data])

  if (!usersQuery.data) {
    return null
  }

  const tableFor = (view: UserStatusView) => (
    <UserTable
      emptyDescription="No user holds this access status yet."
      emptyTitle={statusViewEmptyTitle(view)}
      onClearFilters={clearFilters}
      highlightedUserId={invitedUserId}
      onInvite={canInvite ? openInvitation : undefined}
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
    <div className="relative flex flex-col gap-6 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
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
        {canInvite && (
          <Button className="md:ml-auto" onClick={openInvitation}>
            Invite user
          </Button>
        )}
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

      <UserSheet onClose={closeRecord} user={openUser} />

      <Sheet
        open={isInviting && !isShowingActivationLink}
        // An invitation in flight cannot be taken back: leaving now would only hide its outcome.
        onOpenChange={(open) => !open && !mutations.invite.isPending && closeInvitation()}
      >
        <SheetContent className="overflow-hidden" size="lg">
          <InviteUserPanel
            onInvite={async (value) => {
              const result = await mutations.invite.mutateAsync({ body: value })

              return result.data
            }}
            onSuccess={(invitation) => {
              setIssuedActivationLink(invitation.activationLink)
              void navigate({
                search: (previous) => ({ ...previous, invitedUserId: invitation.user.id }),
              })
            }}
          />
        </SheetContent>
      </Sheet>

      <ActivationLinkDialog
        activationLink={issuedActivationLink}
        invitedUser={invitedUser}
        onAcknowledge={() => closeInvitation('pending')}
        open={isShowingActivationLink}
      />
    </div>
  )
}
