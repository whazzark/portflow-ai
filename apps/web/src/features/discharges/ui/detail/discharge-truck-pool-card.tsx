import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

type PoolEntry = DischargeDetailDto['truckPool'][number]

type DischargeTruckPoolCardProps = {
  discharge: DischargeDetailDto
}

export function DischargeTruckPoolCard({ discharge }: DischargeTruckPoolCardProps) {
  // The trucks the discharge still holds first; the released ones follow as history. A closed
  // discharge holds none, even a truck whose release was never recorded.
  const isHeld = (entry: PoolEntry) => discharge.status !== 'CLOSED' && entry.releasedAt === null
  const held = discharge.truckPool.filter(isHeld)
  const released = discharge.truckPool.filter((entry) => !isHeld(entry))

  return (
    <DetailSection title="Truck pool">
      {discharge.truckPool.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-label="Truck pool">
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Transport company</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Released</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...held, ...released].map((entry) => (
                <TableRow
                  className={classnames(!isHeld(entry) && 'text-muted-foreground')}
                  key={entry.id}
                >
                  <TableCell className="font-medium">
                    <ReferenceLabel name={entry.registration} status={entry.truckStatus} />
                  </TableCell>
                  <TableCell>
                    <ReferenceLabel
                      name={entry.transportCompany.name}
                      status={entry.transportCompany.status}
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(entry.reservedAt)}</TableCell>
                  <TableCell>
                    {entry.releasedAt !== null ? (
                      `Released ${formatDateTime(entry.releasedAt)}`
                    ) : isHeld(entry) ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      'Release not recorded'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No trucks reserved</EmptyTitle>
            <EmptyDescription>No truck has been reserved for this discharge yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </DetailSection>
  )
}
