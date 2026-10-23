import { Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { FloatingSelectionBar } from '@/components/lifecycle/floating-selection-bar'
import { useBulkSelection } from '@/components/lifecycle/use-bulk-selection'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { poolSummary, shiftCountByTruck } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { AddTrucksSheet } from '@/features/discharges/ui/detail/add-trucks-sheet'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { TruckHoldings } from '@/features/discharges/ui/detail/truck-holdings'
import { WithdrawTrucksDialog } from '@/features/discharges/ui/detail/withdraw-trucks-dialog'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

type PoolEntry = DischargeDetailDto['truckPool'][number]

type DischargeTruckPoolCardProps = {
  discharge: DischargeDetailDto
  /** A preparer on a planned discharge may reserve and withdraw trucks. */
  canCorrect?: boolean
}

export function DischargeTruckPoolCard({
  canCorrect = false,
  discharge,
}: DischargeTruckPoolCardProps) {
  const [adding, setAdding] = useState(false)
  const [withdrawing, setWithdrawing] = useState<string[] | null>(null)
  const selection = useBulkSelection()
  const selectAll = useRef<HTMLElement>(null)
  // The trucks the discharge still holds first; the released ones follow as history. A closed
  // discharge holds none, even a truck whose release was never recorded.
  const isHeld = (entry: PoolEntry) => discharge.status !== 'CLOSED' && entry.releasedAt === null
  const held = discharge.truckPool.filter(isHeld)
  const released = discharge.truckPool.filter((entry) => !isHeld(entry))
  const heldIds = held.map((entry) => entry.truckId)
  const heldKey = heldIds.join(',')
  const shiftCounts = shiftCountByTruck(discharge)
  const selectedIds = heldIds.filter((id) => selection.selectedIds.has(id))
  const allSelected = heldIds.length > 0 && selectedIds.length === heldIds.length

  // A truck someone else withdrew leaves the selection with the row, so a withdrawal never
  // counts or sends a truck the discharge no longer holds.
  const { retainOnly, selectedIds: currentSelection } = selection
  useEffect(() => {
    const stillHeld = heldKey === '' ? [] : heldKey.split(',')
    if ([...currentSelection].some((id) => !stillHeld.includes(id))) {
      retainOnly(stillHeld.filter((id) => currentSelection.has(id)))
    }
  }, [heldKey, currentSelection, retainOnly])

  const addTrucks = (
    <Button onClick={() => setAdding(true)} size="sm">
      Add trucks
    </Button>
  )

  const clearSelection = () => {
    selection.clear()
    selectAll.current?.focus()
  }

  return (
    <>
      <DetailSection actions={canCorrect && addTrucks} title="Truck pool">
        {discharge.truckPool.length > 0 ? (
          <div className="grid gap-3">
            <PoolSummaryLine discharge={discharge} />
            <div className="overflow-hidden rounded-lg border">
              <Table aria-label="Truck pool">
                <TableHeader>
                  <TableRow>
                    {canCorrect && (
                      <TableHead className="w-10">
                        {held.length > 0 && (
                          <Checkbox
                            aria-checked={
                              selectedIds.length > 0 && !allSelected ? 'mixed' : allSelected
                            }
                            aria-label="Select all trucks"
                            checked={allSelected}
                            onCheckedChange={(checked) =>
                              selection.toggleMany(heldIds, checked === true)
                            }
                            ref={selectAll}
                          />
                        )}
                      </TableHead>
                    )}
                    <TableHead>Registration</TableHead>
                    <TableHead>Transport company</TableHead>
                    <TableHead>Shifts</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Released</TableHead>
                    {canCorrect && (
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...held, ...released].map((entry) => (
                    <TableRow
                      className={classnames(!isHeld(entry) && 'text-muted-foreground')}
                      key={entry.id}
                    >
                      {canCorrect && (
                        <TableCell>
                          {isHeld(entry) && (
                            <Checkbox
                              aria-label={`Select ${entry.registration}`}
                              checked={selection.selectedIds.has(entry.truckId)}
                              onCheckedChange={() => selection.toggle(entry.truckId)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <ReferenceLabel name={entry.registration} status={entry.truckStatus}>
                          {isHeld(entry) && <TruckHoldings holdings={entry.otherHoldings} />}
                        </ReferenceLabel>
                      </TableCell>
                      <TableCell>
                        <ReferenceLabel
                          name={entry.transportCompany.name}
                          status={entry.transportCompany.status}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {isHeld(entry) ? (
                          (shiftCounts.get(entry.truckId) ?? 0)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                      {canCorrect && (
                        <TableCell className="text-right">
                          {isHeld(entry) && (
                            <Button
                              aria-label={`Withdraw ${entry.registration}`}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setWithdrawing([entry.truckId])}
                              size="icon-sm"
                              variant="ghost"
                            >
                              <Trash2Icon aria-hidden="true" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyTitle>No trucks reserved</EmptyTitle>
              <EmptyDescription>
                No truck has been reserved for this discharge yet.
              </EmptyDescription>
            </EmptyHeader>
            {canCorrect && <EmptyContent>{addTrucks}</EmptyContent>}
          </Empty>
        )}
        {canCorrect && (
          <AddTrucksSheet discharge={discharge} onOpenChange={setAdding} open={adding} />
        )}
        {canCorrect && withdrawing && (
          <WithdrawTrucksDialog
            discharge={discharge}
            onClose={() => setWithdrawing(null)}
            onWithdrawn={() => {
              selection.toggleMany(withdrawing, false)
              // The control that opened the confirmation may have left with its row or with the
              // bar; once the dialog has let go of focus, put it back on the table.
              requestAnimationFrame(() => selectAll.current?.focus())
            }}
            truckIds={withdrawing}
          />
        )}
      </DetailSection>
      {canCorrect && selectedIds.length > 0 && (
        <FloatingSelectionBar
          className="mt-4"
          countLabel={
            selectedIds.length === 1 ? '1 truck selected' : `${selectedIds.length} trucks selected`
          }
          label="Selected trucks"
          onClear={clearSelection}
        >
          <Button onClick={() => setWithdrawing(selectedIds)} size="sm" variant="destructive">
            Withdraw
          </Button>
        </FloatingSelectionBar>
      )}
    </>
  )
}

/** What the pool holds, and whether another discharge competes for any of it. */
function PoolSummaryLine({ discharge }: { discharge: DischargeDetailDto }) {
  const summary = poolSummary(discharge)

  if (summary.heldCount === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
      <p className="text-muted-foreground tabular-nums">
        {summary.heldCount === 1 ? '1 truck reserved' : `${summary.heldCount} trucks reserved`}
        {summary.suspendedCount > 0 && ` · ${summary.suspendedCount} suspended`}
      </p>
      {summary.contested && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
          {/* An active holder keeps its truck whoever starts next; only planned ones race. */}
          {summary.contestedByActive
            ? 'Also held by other discharges: a truck can serve only one active discharge'
            : 'Also held by planned discharges: the first to start keeps the truck'}
        </p>
      )}
    </div>
  )
}
