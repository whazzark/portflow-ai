import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { SortIcon } from '@/components/data-table/sort-icon'
import { HighlightedText } from '@/components/highlighted-text'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { customerMatchesSearch } from '@/features/customers/helpers/customer-search'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerRowActions } from '@/features/customers/ui/customer-row-actions'
import { formatFullName } from '@/features/users/helpers/name'
import { UserAvatar } from '@/features/users/ui/user-avatar'
import { classnames } from '@/libraries/shadcn/helpers'

type LifecycleUser = NonNullable<CustomerDto['archivedBy']>

function lifecycleUserCell(user: LifecycleUser | null) {
  if (!user) {
    return 'Unknown'
  }

  return (
    <div className="flex items-center gap-2">
      <UserAvatar aria-hidden={true} size="sm" user={user} />
      <span>{formatFullName(user)}</span>
    </div>
  )
}

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends import('@tanstack/react-table').RowData> {
    onSelect?: (customerId: string) => void
    onEdit?: (customerId: string) => void
    selectedIds?: Set<string>
    onSelectVisible?: (checked: boolean, customerIds: string[]) => void
  }
}

type CustomerTableProps = {
  customers: CustomerDto[]
  search: string
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  onSelect: (customerId: string) => void
  onEdit: (customerId: string) => void
  emptyTitle: string
  emptyDescription: string
  isArchived: boolean
  canAdminister: boolean
  selectedIds: Set<string>
  onSelectionChange: (customerIds: string[]) => void
}

function createColumns(isArchived: boolean, canAdminister: boolean): ColumnDef<CustomerDto>[] {
  const selectionColumn: ColumnDef<CustomerDto> = {
    id: 'selection',
    enableSorting: false,
    header: ({ table }) => {
      const visibleIds = table.getRowModel().rows.map((row) => row.original.id)
      const selected = table.options.meta?.selectedIds ?? new Set<string>()
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
      const someSelected = visibleIds.some((id) => selected.has(id))

      return (
        <span className="flex h-full items-center justify-center">
          <Checkbox
            aria-label={`Select all ${isArchived ? 'archived' : 'available'} customers`}
            aria-checked={someSelected && !allSelected ? 'mixed' : allSelected}
            checked={allSelected}
            disabled={visibleIds.length === 0}
            onCheckedChange={(checked) =>
              table.options.meta?.onSelectVisible?.(checked === true, visibleIds)
            }
          />
        </span>
      )
    },
    cell: ({ row, table }) => (
      <span className="flex h-full items-center justify-center">
        <Checkbox
          aria-label={`Select customer ${row.original.code}`}
          checked={table.options.meta?.selectedIds?.has(row.original.id) ?? false}
          onCheckedChange={(checked) =>
            table.options.meta?.onSelectVisible?.(checked === true, [row.original.id])
          }
        />
      </span>
    ),
  }

  return [
    ...(canAdminister ? [selectionColumn] : []),
    {
      accessorKey: 'code',
      header: 'Customer code',
      sortingFn: 'alphanumeric',
      cell: ({ row, table }) => (
        <Button
          aria-label={`View customer ${row.original.code}`}
          className="h-auto px-0 font-medium font-mono hover:bg-transparent"
          onClick={() => table.options.meta?.onSelect?.(row.original.id)}
          variant="ghost"
        >
          <HighlightedText
            search={table.getState().globalFilter as string}
            value={row.original.code}
          />
        </Button>
      ),
    },
    {
      accessorKey: 'companyName',
      header: 'Company name',
      sortingFn: 'text',
      cell: ({ row, table }) => (
        <HighlightedText
          search={table.getState().globalFilter as string}
          value={row.original.companyName}
        />
      ),
    },
    ...(isArchived
      ? [
          {
            accessorKey: 'archiveComment',
            header: 'Archive comment',
            sortingFn: 'text' as const,
            cell: ({ row, table }: CellContext<CustomerDto, unknown>) => (
              <HighlightedText
                search={table.getState().globalFilter as string}
                value={row.original.archiveComment ?? '—'}
              />
            ),
          } satisfies ColumnDef<CustomerDto>,
          {
            accessorKey: 'archivedBy',
            header: 'Archived by',
            enableSorting: false,
            cell: ({ row }: { row: { original: CustomerDto } }) => {
              return lifecycleUserCell(row.original.archivedBy)
            },
          } satisfies ColumnDef<CustomerDto>,
        ]
      : [
          {
            accessorKey: 'reactivationComment',
            header: 'Reactivation comment',
            sortingFn: 'text' as const,
            cell: ({ row, table }: CellContext<CustomerDto, unknown>) => (
              <HighlightedText
                search={table.getState().globalFilter as string}
                value={row.original.reactivationComment ?? '—'}
              />
            ),
          } satisfies ColumnDef<CustomerDto>,
          {
            accessorKey: 'reactivatedBy',
            header: 'Reactivated by',
            enableSorting: false,
            cell: ({ row }: { row: { original: CustomerDto } }) =>
              lifecycleUserCell(row.original.reactivatedBy),
          } satisfies ColumnDef<CustomerDto>,
        ]),
    // Last column, as in the truck and transport-company directories: the row's own administration
    // menu, so a lifecycle change never requires opening the detail pane first.
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row, table }: CellContext<CustomerDto, unknown>) => (
        <div className="flex justify-end">
          <CustomerRowActions
            canAdminister={canAdminister}
            customer={row.original}
            onEdit={table.options.meta?.onEdit}
            onView={table.options.meta?.onSelect}
          />
        </div>
      ),
    } satisfies ColumnDef<CustomerDto>,
  ]
}

export function CustomerTable({
  customers,
  search,
  sorting,
  onSortingChange,
  onSelect,
  onEdit,
  emptyTitle,
  emptyDescription,
  isArchived,
  canAdminister,
  selectedIds,
  onSelectionChange,
}: CustomerTableProps) {
  const columns = createColumns(isArchived, canAdminister)
  const table = useReactTable({
    data: customers,
    columns,
    state: { globalFilter: search, sorting },
    onSortingChange,
    meta: {
      onSelect,
      onEdit,
      selectedIds,
      onSelectVisible: (checked, customerIds) => {
        const next = new Set(selectedIds)
        customerIds.forEach((id) => {
          if (checked) {
            next.add(id)
          } else {
            next.delete(id)
          }
        })
        onSelectionChange([...next])
      },
    },
    globalFilterFn: (row, _columnId, filterValue) =>
      customerMatchesSearch(row.original, filterValue),
    // A row now carries state — an open confirmation and the comment typed into it — so it is
    // keyed by the customer itself: a refetch that shifts positions must never rebind an open
    // dialog to a different record.
    getRowId: (customer) => customer.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows

  return (
    <div className="overflow-hidden rounded-lg border md:flex md:h-full md:min-h-0 md:flex-col md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:flex-1 md:[&_[data-slot=table-container]]:overflow-auto">
      <Table aria-label={isArchived ? 'Archived customers' : 'Available customers'}>
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
                    className={
                      header.column.id === 'selection' ? 'w-10 min-w-10 max-w-10 p-0' : undefined
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
            rows.map((row) => {
              const isSelected = selectedIds.has(row.original.id)

              return (
                <TableRow
                  aria-selected={isSelected}
                  className={classnames(
                    'cursor-pointer transition-colors aria-selected:bg-primary/5 aria-selected:hover:bg-primary/10',
                    isArchived && 'text-muted-foreground',
                  )}
                  onClick={() => onSelect(row.original.id)}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={
                        cell.column.id === 'selection'
                          ? 'relative w-10 min-w-10 max-w-10 p-0'
                          : cell.column.id === 'actions'
                            ? 'w-10 min-w-10 max-w-10'
                            : undefined
                      }
                      // The row itself opens the detail pane; the selection checkbox and the
                      // actions menu are their own affordances and must not trigger it too —
                      // opening the pane underneath would tear the menu down as it renders.
                      onClick={
                        cell.column.id === 'selection' || cell.column.id === 'actions'
                          ? (event) => event.stopPropagation()
                          : undefined
                      }
                      key={cell.id}
                    >
                      {cell.column.id === 'selection' && (
                        <span
                          aria-hidden="true"
                          className={classnames(
                            'pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary transition-opacity duration-150',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                          data-slot="customer-selection-indicator"
                        />
                      )}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>{emptyDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
