import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DischargeDto, DischargeStatusFilter } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'

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

function customerNames(discharge: DischargeDto) {
  return [...new Set(discharge.productLots.map((productLot) => productLot.customerName))]
}

type DischargeListProps = {
  discharges: DischargeDto[]
  isNoMatch: boolean
  status: DischargeStatusFilter
}

export function DischargeList({ discharges, isNoMatch, status }: DischargeListProps) {
  return (
    <div className="overflow-hidden rounded-lg border md:flex md:max-h-full md:min-h-0 md:flex-col md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:overflow-auto">
      <Table aria-label="Discharges">
        <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-background">
          <TableRow>
            <TableHead>Vessel</TableHead>
            <TableHead>IMO</TableHead>
            <TableHead>Dock</TableHead>
            <TableHead>Expected start</TableHead>
            <TableHead>Customers</TableHead>
            <TableHead>Product lots</TableHead>
            <TableHead>Shifts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discharges.length > 0 ? (
            discharges.map((discharge) => {
              const customers = customerNames(discharge)

              // No handler, no cursor, no row action: opening one discharge is GH-58.
              return (
                <TableRow key={discharge.id}>
                  <TableCell className="font-medium">{discharge.vesselName}</TableCell>
                  <TableCell>
                    {discharge.vesselImo ?? (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell>{discharge.dock.name}</TableCell>
                  <TableCell>{formatDateTime(discharge.expectedStartAt)}</TableCell>
                  <TableCell>
                    {/* A discharge with no lot yet has no customer yet — a real zero, not an
                        unspecified field, so it reads as the same em dash absent values use
                        elsewhere rather than borrowing the IMO's `Not specified`. */}
                    {customers.length > 0 ? (
                      customers.join(', ')
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{discharge.productLots.length}</TableCell>
                  <TableCell className="tabular-nums">{discharge.shiftCount}</TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={7}>
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyTitle>
                      {isNoMatch ? 'No matching discharges' : EMPTY_TITLES[status]}
                    </EmptyTitle>
                    <EmptyDescription>
                      {isNoMatch
                        ? 'No discharge of this status matches your search.'
                        : EMPTY_DESCRIPTIONS[status]}
                    </EmptyDescription>
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
