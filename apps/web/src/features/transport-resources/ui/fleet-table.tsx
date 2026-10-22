import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FleetGroup, FleetTruck } from '@/features/transport-resources/helpers/fleet-view'
import type { FleetSort } from '@/features/transport-resources/helpers/transport-resources-search'
import { classnames } from '@/libraries/shadcn/helpers'
import { FLEET_COLUMN_COUNT } from './company-group-rows'

type SortableColumn = { sort: FleetSort; label: string; className: string }

const COLUMNS: Array<SortableColumn | { sort: null; label: string; className: string }> = [
  { sort: 'registration', label: 'Registration', className: 'w-[190px] pl-12' },
  { sort: 'vehicleModel', label: 'Vehicle model', className: 'w-[160px]' },
  { sort: 'capacity', label: 'Capacity', className: 'w-[100px]' },
  { sort: null, label: 'Suspension', className: '' },
  { sort: 'status', label: 'Status', className: 'w-[130px]' },
]

function SortHeader({
  column,
  sort,
  order,
  onSort,
}: {
  column: SortableColumn
  sort: FleetSort
  order: 'asc' | 'desc'
  onSort: (sort: FleetSort) => void
}) {
  const active = column.sort === sort
  const Icon = active ? (order === 'asc' ? ArrowDownIcon : ArrowUpIcon) : ArrowUpDownIcon

  return (
    <TableHead
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={classnames('h-[42px] px-3.5 font-semibold text-[13px]', column.className)}
    >
      <button
        className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSort(column.sort)}
        type="button"
      >
        {column.label}
        <Icon
          aria-hidden="true"
          className={classnames('size-3.5', active ? 'text-foreground' : 'text-muted-foreground')}
        />
      </button>
    </TableHead>
  )
}

export type FleetTableProps = {
  groups: FleetGroup[]
  sort: FleetSort
  order: 'asc' | 'desc'
  onSort: (sort: FleetSort) => void
  isCollapsed: (companyId: string) => boolean
  renderGroupHeader: (group: FleetGroup) => ReactNode
  renderTruck: (fleetTruck: FleetTruck, group: FleetGroup) => ReactNode
  /** Rows a group adds after its trucks — an open detail, an inline form. */
  renderGroupFooter?: (group: FleetGroup) => ReactNode
  /** Rows above every group — the inline company creation. */
  leadingRows?: ReactNode
  /** Replaces the groups when nothing is listed. */
  emptyContent?: ReactNode
}

export function FleetTable({
  groups,
  sort,
  order,
  onSort,
  isCollapsed,
  renderGroupHeader,
  renderTruck,
  renderGroupFooter,
  leadingRows,
  emptyContent,
}: FleetTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table aria-label="Trucks by transport company" className="min-w-[860px]">
        <TableHeader>
          <TableRow className="border-b-0 hover:bg-transparent">
            {COLUMNS.map((column) =>
              column.sort ? (
                <SortHeader
                  column={column as SortableColumn}
                  key={column.label}
                  onSort={onSort}
                  order={order}
                  sort={sort}
                />
              ) : (
                <TableHead
                  className={classnames(
                    'h-[42px] px-3.5 font-semibold text-[13px] text-muted-foreground',
                    column.className,
                  )}
                  key={column.label}
                >
                  {column.label}
                </TableHead>
              ),
            )}
            <TableHead className="w-[90px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leadingRows}
          {groups.length === 0 && emptyContent ? (
            <TableRow className="border-t hover:bg-transparent">
              <TableCell colSpan={FLEET_COLUMN_COUNT}>{emptyContent}</TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <Fragment key={group.company.id}>
                {renderGroupHeader(group)}
                {!isCollapsed(group.company.id) &&
                  group.trucks.map((fleetTruck) => (
                    <Fragment key={fleetTruck.truck.id}>{renderTruck(fleetTruck, group)}</Fragment>
                  ))}
                {!isCollapsed(group.company.id) && renderGroupFooter?.(group)}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
