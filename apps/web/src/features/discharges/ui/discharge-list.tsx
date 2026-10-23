import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DischargeDto, DischargeStatusFilter } from '@/features/discharges/types'
import { DischargeCustomers } from '@/features/discharges/ui/list/discharge-customers'
import { DischargeShiftCell } from '@/features/discharges/ui/list/discharge-shift-cell'
import { DischargesNoMatch } from '@/features/discharges/ui/list/discharges-no-match'
import { PreparationBadge } from '@/features/discharges/ui/list/preparation-badge'
import { formatDateTime } from '@/helpers/dates'
import { formatTonnes } from '@/helpers/tonnes'

const EMPTY_TITLES = {
  active: 'No active discharges',
  closed: 'No closed discharges',
  planned: 'No planned discharges',
} as const satisfies Record<DischargeStatusFilter, string>

const EMPTY_DESCRIPTIONS = {
  active: 'No discharge has started on the site yet.',
  closed: 'No discharge has been declared finished yet.',
  planned: 'No discharge has been prepared for a later date yet.',
} as const satisfies Record<DischargeStatusFilter, string>

type Column = {
  header: string
  cell: (discharge: DischargeDto) => ReactNode
  className?: string
}

function NotSpecified() {
  return <span className="text-muted-foreground italic">Not specified</span>
}

function lotsAndTonnage(discharge: DischargeDto) {
  const lots = discharge.productLots.length
  const label = lots === 1 ? '1 lot' : `${lots} lots`

  // A discharge with no lot expects nothing yet: a zero tonnage beside "0 lots" says it twice.
  return lots === 0 ? label : `${label} · ${formatTonnes(discharge.expectedTonnage)}`
}

const DOCK: Column = { header: 'Dock', cell: (discharge) => discharge.dock.name }

const STARTED: Column = {
  header: 'Started',
  cell: (discharge) =>
    discharge.startedAt ? formatDateTime(discharge.startedAt) : <NotSpecified />,
}

const EXPECTED_TONNAGE: Column = {
  header: 'Expected tonnage',
  cell: (discharge) => formatTonnes(discharge.expectedTonnage),
  className: 'tabular-nums',
}

const CUSTOMERS: Column = {
  header: 'Customers',
  cell: (discharge) => <DischargeCustomers discharge={discharge} />,
  className: 'max-w-72',
}

/**
 * What each status's row is read for: an active discharge by who runs it now, a planned one by
 * whether it can start, a closed one by when it ran and what it represented. The vessel leads and
 * the customers close every row; the status itself is the selected tab's, never a column.
 */
const COLUMNS = {
  active: [
    DOCK,
    STARTED,
    { header: 'Active shift', cell: (discharge) => <DischargeShiftCell discharge={discharge} /> },
    EXPECTED_TONNAGE,
    CUSTOMERS,
  ],
  planned: [
    DOCK,
    { header: 'Expected start', cell: (discharge) => formatDateTime(discharge.expectedStartAt) },
    {
      header: 'Preparation',
      cell: (discharge) =>
        // Never Ready by default: a count nobody evaluated is not a discharge ready to start.
        discharge.startProblemCount === null ? (
          <span className="text-muted-foreground italic">Readiness unknown</span>
        ) : (
          <PreparationBadge startProblemCount={discharge.startProblemCount} />
        ),
    },
    { header: 'Lots · tonnage', cell: lotsAndTonnage, className: 'tabular-nums' },
    CUSTOMERS,
  ],
  closed: [
    DOCK,
    STARTED,
    {
      header: 'Closed',
      // Recorded only once Discharge Closure keeps the time; until then no time is invented.
      cell: () => (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            —
          </span>
          <span className="sr-only">Closure time not recorded</span>
        </>
      ),
    },
    EXPECTED_TONNAGE,
    CUSTOMERS,
  ],
} as const satisfies Record<DischargeStatusFilter, Column[]>

type DischargeListProps = {
  discharges: DischargeDto[]
  isNoMatch: boolean
  search: string
  status: DischargeStatusFilter
  onClearSearch: () => void
  /** Offered inside a genuinely empty collection, never beside a search that matched nothing. */
  createAction?: ReactNode
}

export function DischargeList({
  createAction,
  discharges,
  isNoMatch,
  onClearSearch,
  search,
  status,
}: DischargeListProps) {
  const navigate = useNavigate({ from: '/discharges' })
  const columns: readonly Column[] = COLUMNS[status]
  // The vessel and the trailing chevron frame every status's own columns.
  const columnCount = columns.length + 2

  // The list's status and search travel with the detail, so its way back restores them.
  const openDischarge = (dischargeId: string) => {
    void navigate({
      params: { dischargeId },
      search: (previous) => previous,
      to: '/discharges/$dischargeId',
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border md:flex md:max-h-full md:min-h-0 md:flex-col md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:overflow-auto">
      <Table aria-label="Discharges">
        <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-background">
          <TableRow>
            <TableHead>Vessel</TableHead>
            {columns.map((column) => (
              <TableHead key={column.header}>{column.header}</TableHead>
            ))}
            <TableHead className="w-10">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discharges.length > 0 ? (
            discharges.map((discharge) => (
              // The vessel link is what a keyboard, a middle click, or "open in new tab" uses; the
              // row click is only a pointer convenience on top of it, as in the customer table.
              <TableRow
                className="cursor-pointer"
                key={discharge.id}
                onClick={(event) => {
                  // The link navigates on its own; letting its click reach the row would
                  // navigate twice.
                  if ((event.target as HTMLElement).closest('a')) {
                    return
                  }

                  openDischarge(discharge.id)
                }}
              >
                <TableCell>
                  <span className="flex flex-col">
                    <Link
                      aria-label={`View discharge ${discharge.vesselName}`}
                      className="font-medium hover:underline"
                      from="/discharges"
                      params={{ dischargeId: discharge.id }}
                      search={(previous) => previous}
                      to="/discharges/$dischargeId"
                    >
                      {discharge.vesselName}
                    </Link>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {discharge.vesselImo ?? <NotSpecified />}
                    </span>
                  </span>
                </TableCell>
                {columns.map((column) => (
                  <TableCell className={column.className} key={column.header}>
                    {column.cell(discharge)}
                  </TableCell>
                ))}
                <TableCell className="text-muted-foreground">
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount}>
                {isNoMatch ? (
                  <DischargesNoMatch
                    onClearSearch={onClearSearch}
                    search={search}
                    status={status}
                  />
                ) : (
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyTitle>{EMPTY_TITLES[status]}</EmptyTitle>
                      <EmptyDescription>{EMPTY_DESCRIPTIONS[status]}</EmptyDescription>
                    </EmptyHeader>
                    {createAction && <EmptyContent>{createAction}</EmptyContent>}
                  </Empty>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
