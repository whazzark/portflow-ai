import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { UserPlusIcon, UsersIcon } from 'lucide-react'
import { SortIcon } from '@/components/data-table/sort-icon'
import { HighlightedText } from '@/components/highlighted-text'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { StatusIndicator } from '@/components/ui/status-indicator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { activationLinkState } from '@/features/users/helpers/activation-link'
import { formatFullName } from '@/features/users/helpers/name'
import {
  statusViewTableLabel,
  USER_ROLE_LABELS,
  type UserStatusView,
} from '@/features/users/helpers/user-labels'
import { owesPasswordRenewal } from '@/features/users/helpers/user-permissions'
import { compareUsers } from '@/features/users/helpers/user-search'
import type { UserDto } from '@/features/users/types'
import { UserAvatar } from '@/features/users/ui/user-avatar'
import { UserRowActions } from '@/features/users/ui/user-row-actions'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends import('@tanstack/react-table').RowData> {
    onSelect?: (userId: string) => void
    onEdit?: (userId: string) => void
  }

  interface ColumnMeta<TData extends import('@tanstack/react-table').RowData, TValue> {
    /** Width and padding a column keeps on its header and every one of its cells. */
    className?: string
  }
}

type UserTableProps = {
  users: UserDto[]
  view: UserStatusView
  search: string
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  emptyTitle: string
  emptyDescription: string
  onSelect: (userId: string) => void
  onEdit: (userId: string) => void
  /** Users this status view holds before the search and the role filter narrow it. */
  totalInView: number
  onClearFilters: () => void
  /** The user a just-completed invitation created. Decoration only: it selects nothing. */
  highlightedUserId?: string
  /** Offered in an empty view no filter is narrowing, to the viewers allowed to invite. */
  onInvite?: () => void
}

/**
 * The email sits under the name rather than in a column of its own: it is how an administrator
 * tells two namesakes apart, not something they sort or scan down on its own.
 */
const identityColumns: ColumnDef<UserDto>[] = [
  {
    id: 'name',
    header: 'User',
    accessorFn: (user) => formatFullName(user),
    sortingFn: (left, right) => compareUsers(left.original, right.original, 'name'),
    meta: { className: 'w-[40%]' },
    cell: ({ row, table }) => (
      <div className="flex items-center gap-3">
        <UserAvatar aria-hidden={true} user={row.original} />
        <div className="flex min-w-0 flex-col items-start">
          <Button
            aria-label={`View user ${formatFullName(row.original)}`}
            className="h-auto px-0 py-0 font-semibold hover:bg-transparent hover:text-indicator dark:hover:bg-transparent"
            onClick={() => table.options.meta?.onSelect?.(row.original.id)}
            variant="ghost"
          >
            <HighlightedText
              search={table.getState().globalFilter as string}
              value={formatFullName(row.original)}
            />
          </Button>
          <span className="truncate text-[13px] text-muted-foreground">
            <HighlightedText
              search={table.getState().globalFilter as string}
              value={row.original.email}
            />
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'role',
    header: 'Role',
    accessorFn: (user) => USER_ROLE_LABELS[user.role],
    sortingFn: (left, right) => compareUsers(left.original, right.original, 'role'),
    meta: { className: 'w-[20%]' },
    cell: ({ row }) => USER_ROLE_LABELS[row.original.role],
  },
]

const passwordColumn: ColumnDef<UserDto> = {
  id: 'password',
  header: 'Password',
  enableSorting: false,
  // So an organization admin can tell who owes a renewal without opening every record. Blank
  // rather than "None": a user who owes nothing has nothing to report, and a column of negatives
  // would bury the few that matter. Viewers who may not consult the access history never receive
  // the key, so the column is blank for them throughout.
  cell: ({ row }) =>
    owesPasswordRenewal(row.original) ? (
      <StatusIndicator label="Renewal required" variant="warning" />
    ) : null,
}

/**
 * What the cancelled view shows in place of the password: a cancelled user never held one, so the
 * renewal column could only ever be blank there, whereas why their access was withdrawn is the one
 * thing an administrator scanning that view wants to know (`#12`). One line, with the whole comment
 * on hover — it may run to 1,000 characters. Blank when none was written, for the reason the
 * password column gives.
 */
const cancellationCommentColumn: ColumnDef<UserDto> = {
  id: 'cancellationComment',
  header: 'Comment',
  enableSorting: false,
  cell: ({ row }) => {
    const comment = row.original.cancellationComment

    return comment ? (
      <span className="block max-w-xs truncate text-muted-foreground" title={comment}>
        {comment}
      </span>
    ) : null
  },
}

/**
 * What the pending view shows in place of the password, for the same reason the cancelled view
 * does: a pending user has not chosen one yet. When each invitation was issued is what lets an
 * administrator spot the stale ones — to renew their link or cancel them — without opening every
 * record. Deliberately the invitation date and not a derived link expiry: a renewed link will outlive
 * the invitation it belongs to, so an expiry computed from this date would soon be wrong.
 *
 * The inviting administrator sits under the date, worded as the access history words it, so the
 * administrator to ask about an invitation is on the row too. An invitation recorded without one
 * shows its date alone.
 */
const invitedColumn: ColumnDef<UserDto> = {
  id: 'invitedAt',
  header: 'Invited',
  enableSorting: false,
  cell: ({ row }) => {
    const { invitedAt, invitedBy } = row.original

    return invitedAt ? (
      <div className="grid">
        <span className="tabular-nums">{formatDateTime(invitedAt)}</span>
        {invitedBy && (
          <span className="text-muted-foreground text-xs">by {formatFullName(invitedBy)}</span>
        )}
      </div>
    ) : null
  },
}

/**
 * Beside the invitation date in the pending view: so an organization admin can tell which
 * invitations need a renewal without opening every record, the way the Password column marks who
 * owes a renewal. Read from the live link's own expiry rather than derived from the invitation date,
 * for the reason the invitation column gives. Blank for a link that still works, for the same reason
 * the password column is blank for a user who owes nothing.
 */
const activationLinkColumn: ColumnDef<UserDto> = {
  id: 'activationLink',
  header: 'Activation link',
  enableSorting: false,
  cell: ({ row }) => {
    const state = activationLinkState(row.original, Date.now())

    if (state === 'expired') {
      return <StatusIndicator label="Expired" variant="warning" />
    }
    if (state === 'missing') {
      return <StatusIndicator label="Not issued" variant="warning" />
    }

    return null
  },
}

// Last column, as in the customer, truck, and transport-company directories: the row's own
// administration menu, so a correction or an access change never requires opening the record
// first.
const actionsColumn: ColumnDef<UserDto> = {
  id: 'actions',
  header: () => <span className="sr-only">Actions</span>,
  enableSorting: false,
  meta: { className: 'w-14 min-w-14 max-w-14 pr-2.5' },
  cell: ({ row, table }) => (
    <div className="flex justify-end">
      <UserRowActions
        onEdit={table.options.meta?.onEdit}
        onView={table.options.meta?.onSelect}
        user={row.original}
      />
    </div>
  ),
}

/**
 * The columns each status view shows, as stable references so the table never rebuilds them. Only
 * the columns after the role vary: the password renewal indicator where a password can exist, and
 * what the administrator needs instead where it cannot — for a pending user, when they were invited
 * and whether their activation link still works.
 */
const COLUMNS_BY_VIEW: Record<UserStatusView, ColumnDef<UserDto>[]> = {
  active: [...identityColumns, passwordColumn, actionsColumn],
  pending: [...identityColumns, invitedColumn, activationLinkColumn, actionsColumn],
  deactivated: [...identityColumns, passwordColumn, actionsColumn],
  cancelled: [...identityColumns, cancellationCommentColumn, actionsColumn],
}

export function UserTable({
  users,
  view,
  search,
  sorting,
  onSortingChange,
  emptyTitle,
  emptyDescription,
  onSelect,
  onEdit,
  totalInView,
  onClearFilters,
  highlightedUserId,
  onInvite,
}: UserTableProps) {
  const columns = COLUMNS_BY_VIEW[view]
  const table = useReactTable({
    data: users,
    columns,
    state: { globalFilter: search, sorting },
    onSortingChange,
    // The directory is always sorted by one column or the other, because the URL carries a `sort`
    // and an `order` at all times. Left at its default, a third click on a header would clear the
    // sorting the URL cannot express, and the table would silently fall back to another column.
    enableSortingRemoval: false,
    meta: { onSelect, onEdit },
    getRowId: (user) => user.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  // A view whose users were all excluded by the filters is a no-match result; a view that holds no
  // user at all is empty whatever the filters say, and offering to clear them would mislead.
  const isNoMatch = rows.length === 0 && totalInView > 0

  // The empty and no-match states replace the table rather than sit in a row of it: a header over
  // nothing to sort reads as a broken table.
  if (rows.length === 0) {
    return (
      <Empty className="flex-none gap-2 rounded-lg border border-solid bg-card px-6 py-14">
        <EmptyHeader>
          <EmptyMedia
            className="size-11 rounded-[10px] text-muted-foreground [&_svg:not([class*='size-'])]:size-5"
            variant="icon"
          >
            <UsersIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="font-semibold text-[15px]">
            {isNoMatch ? 'No matching users' : emptyTitle}
          </EmptyTitle>
          <EmptyDescription>
            {isNoMatch ? 'No user of this view matches the active filters.' : emptyDescription}
          </EmptyDescription>
        </EmptyHeader>
        {isNoMatch ? (
          <Button className="mt-3" onClick={onClearFilters} size="lg" variant="outline">
            Clear filters
          </Button>
        ) : (
          onInvite && (
            <Button className="mt-3" onClick={onInvite} size="lg" variant="outline">
              <UserPlusIcon aria-hidden="true" />
              Invite user
            </Button>
          )
        )}
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card md:flex md:max-h-full md:min-h-0 md:flex-col md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:flex-1 md:[&_[data-slot=table-container]]:overflow-auto">
      <Table aria-label={statusViewTableLabel(view)}>
        <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-card">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className="hover:bg-transparent" key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const direction = header.column.getIsSorted()

                return (
                  <TableHead
                    aria-sort={
                      direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                    className={classnames(
                      'h-[42px] px-3.5 font-semibold text-[13px]',
                      header.column.columnDef.meta?.className,
                    )}
                    key={header.id}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        className="-ml-2 px-2 font-semibold text-[13px]"
                        onClick={header.column.getToggleSortingHandler()}
                        size="sm"
                        variant="ghost"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon direction={direction} />
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              className="cursor-pointer data-[highlighted=true]:bg-accent/60"
              data-highlighted={row.original.id === highlightedUserId}
              key={row.id}
              onClick={() => onSelect(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  className={classnames(
                    'h-14 px-3.5 text-sm',
                    cell.column.columnDef.meta?.className,
                  )}
                  key={cell.id}
                  // The row itself opens the record; the actions menu is its own affordance and
                  // must not trigger it too — opening the record underneath would tear the menu
                  // down as it renders.
                  onClick={
                    cell.column.id === 'actions' ? (event) => event.stopPropagation() : undefined
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
