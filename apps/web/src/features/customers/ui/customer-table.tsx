import {
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
import { classnames } from '@/libraries/shadcn/helpers'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends import('@tanstack/react-table').RowData> {
    onSelect?: (customerId: string) => void
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
  emptyTitle: string
  emptyDescription: string
  isArchived: boolean
  canAdminister: boolean
  selectedIds: Set<string>
  onSelectionChange: (customerIds: string[]) => void
  hasBulkActions: boolean
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
        <Checkbox
          aria-label={`Select all ${isArchived ? 'archived' : 'available'} customers`}
          aria-checked={someSelected && !allSelected ? 'mixed' : allSelected}
          checked={allSelected}
          disabled={visibleIds.length === 0}
          onCheckedChange={(checked) =>
            table.options.meta?.onSelectVisible?.(checked === true, visibleIds)
          }
        />
      )
    },
    cell: ({ row, table }) => (
      <Checkbox
        aria-label={`Select customer ${row.original.code}`}
        checked={table.options.meta?.selectedIds?.has(row.original.id) ?? false}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) =>
          table.options.meta?.onSelectVisible?.(checked === true, [row.original.id])
        }
      />
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
          className="h-auto px-0 font-medium font-mono after:absolute after:inset-0 after:rounded-md after:content-[''] hover:bg-transparent focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
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
    {
      accessorKey: 'updatedAt',
      header: 'Last updated',
      sortingFn: 'datetime',
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString('en-GB'),
    },
  ]
}

export function CustomerTable({
  customers,
  search,
  sorting,
  onSortingChange,
  onSelect,
  emptyTitle,
  emptyDescription,
  isArchived,
  canAdminister,
  selectedIds,
  onSelectionChange,
  hasBulkActions,
}: CustomerTableProps) {
  const columns = createColumns(isArchived, canAdminister)
  const table = useReactTable({
    data: customers,
    columns,
    state: { globalFilter: search, sorting },
    onSortingChange,
    meta: {
      onSelect,
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows

  return (
    <div
      className={classnames(
        'overflow-hidden rounded-lg border md:flex md:h-full md:min-h-0 md:flex-col md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:flex-1 md:[&_[data-slot=table-container]]:overflow-auto',
        hasBulkActions && '[&_[data-slot=table-container]]:pb-20',
      )}
    >
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
                className={
                  isArchived
                    ? 'relative cursor-pointer text-muted-foreground'
                    : 'relative cursor-pointer'
                }
                onClick={() => onSelect(row.original.id)}
                key={row.id}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    className={cell.column.id === 'selection' ? 'relative z-10' : undefined}
                    key={cell.id}
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
