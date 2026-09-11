import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { SortIcon } from '@/components/data-table/sort-icon'
import { HighlightedText } from '@/components/highlighted-text'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatFullName } from '@/features/users/helpers/name'
import {
  statusViewTableLabel,
  USER_ROLE_LABELS,
  type UserStatusView,
} from '@/features/users/helpers/user-labels'
import { compareUsers } from '@/features/users/helpers/user-search'
import type { UserDto } from '@/features/users/types'
import { UserAvatar } from '@/features/users/ui/user-avatar'
import { UserRowActions } from '@/features/users/ui/user-row-actions'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends import('@tanstack/react-table').RowData> {
    onSelect?: (userId: string) => void
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
  /** Users this status view holds before the search and the role filter narrow it. */
  totalInView: number
  onClearFilters: () => void
  /** The user a just-completed invitation created. Decoration only: it selects nothing. */
  highlightedUserId?: string
  /** Offered in an empty view no filter is narrowing, to the viewers allowed to invite. */
  onInvite?: () => void
}

const columns: ColumnDef<UserDto>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorFn: (user) => formatFullName(user),
    sortingFn: (left, right) => compareUsers(left.original, right.original, 'name'),
    cell: ({ row, table }) => (
      <div className="flex items-center gap-2">
        <UserAvatar aria-hidden={true} size="sm" user={row.original} />
        <Button
          aria-label={`View user ${formatFullName(row.original)}`}
          className="h-auto px-0 font-medium hover:bg-transparent"
          onClick={() => table.options.meta?.onSelect?.(row.original.id)}
          variant="ghost"
        >
          <HighlightedText
            search={table.getState().globalFilter as string}
            value={formatFullName(row.original)}
          />
        </Button>
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    enableSorting: false,
    cell: ({ row, table }) => (
      <span className="text-muted-foreground">
        <HighlightedText
          search={table.getState().globalFilter as string}
          value={row.original.email}
        />
      </span>
    ),
  },
  {
    id: 'role',
    header: 'Role',
    accessorFn: (user) => USER_ROLE_LABELS[user.role],
    sortingFn: (left, right) => compareUsers(left.original, right.original, 'role'),
    cell: ({ row }) => USER_ROLE_LABELS[row.original.role],
  },
  // Last column, as in the customer, truck, and transport-company directories: the row's own
  // administration menu, so an access change never requires opening the record first.
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    cell: ({ row, table }) => (
      <div className="flex justify-end">
        <UserRowActions onView={table.options.meta?.onSelect} user={row.original} />
      </div>
    ),
  },
]

export function UserTable({
  users,
  view,
  search,
  sorting,
  onSortingChange,
  emptyTitle,
  emptyDescription,
  onSelect,
  totalInView,
  onClearFilters,
  highlightedUserId,
  onInvite,
}: UserTableProps) {
  const table = useReactTable({
    data: users,
    columns,
    state: { globalFilter: search, sorting },
    onSortingChange,
    // The directory is always sorted by one column or the other, because the URL carries a `sort`
    // and an `order` at all times. Left at its default, a third click on a header would clear the
    // sorting the URL cannot express, and the table would silently fall back to another column.
    enableSortingRemoval: false,
    meta: { onSelect },
    getRowId: (user) => user.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  // A view whose users were all excluded by the filters is a no-match result; a view that holds no
  // user at all is empty whatever the filters say, and offering to clear them would mislead.
  const isNoMatch = rows.length === 0 && totalInView > 0

  return (
    <div className="overflow-hidden rounded-lg border md:flex md:max-h-full md:min-h-0 md:flex-col md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:flex-1 md:[&_[data-slot=table-container]]:overflow-auto">
      <Table aria-label={statusViewTableLabel(view)}>
        <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-background">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
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
                    key={header.id}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        className="-ml-2"
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
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                className="cursor-pointer transition-colors data-[highlighted=true]:bg-accent/60"
                data-highlighted={row.original.id === highlightedUserId}
                key={row.id}
                onClick={() => onSelect(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    className={cell.column.id === 'actions' ? 'w-10 min-w-10 max-w-10' : undefined}
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
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyTitle>{isNoMatch ? 'No matching users' : emptyTitle}</EmptyTitle>
                    <EmptyDescription>
                      {isNoMatch
                        ? 'No user of this view matches the active filters.'
                        : emptyDescription}
                    </EmptyDescription>
                  </EmptyHeader>
                  {isNoMatch ? (
                    <Button onClick={onClearFilters} size="sm" variant="outline">
                      Clear filters
                    </Button>
                  ) : (
                    onInvite && (
                      <Button onClick={onInvite} size="sm">
                        Invite user
                      </Button>
                    )
                  )}
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
