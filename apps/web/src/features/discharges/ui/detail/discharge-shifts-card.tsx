import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { openShift } from '@/features/discharges/shift-calendar'
import { heldPoolEntries } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { ShiftCalendar } from '@/features/discharges/ui/detail/shift-calendar'
import { ShiftDetail } from '@/features/discharges/ui/detail/shift-detail'
import { ShiftTrucksSheet } from '@/features/discharges/ui/detail/shift-trucks-sheet'

const dischargeRoute = getRouteApi('/_authenticated/discharges/$dischargeId')

type DischargeShiftsCardProps = {
  discharge: DischargeDetailDto
  /** A preparer on a planned discharge may choose each planned shift's trucks. */
  canCorrect?: boolean
}

export function DischargeShiftsCard({ canCorrect = false, discharge }: DischargeShiftsCardProps) {
  const { shiftId } = dischargeRoute.useSearch()
  const navigate = dischargeRoute.useNavigate()
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const selectedShift = openShift(discharge.shifts, shiftId)
  const editingShift = discharge.shifts.find((shift) => shift.id === editingShiftId)
  // A shift's trucks come from the pool, so an empty pool leaves a preparer nothing to select.
  const needsPool =
    canCorrect &&
    heldPoolEntries(discharge).length === 0 &&
    discharge.shifts.some((shift) => shift.status === 'PLANNED')

  // Replaced rather than pushed: looking at another shift is not a place to go back to, and the
  // page keeps its scroll position while the detail below the calendar changes.
  const selectShift = (nextShiftId: string) => {
    void navigate({
      search: (previous) => ({ ...previous, shiftId: nextShiftId }),
      replace: true,
      resetScroll: false,
    })
  }

  return (
    <DetailSection title="Shifts">
      {selectedShift ? (
        <div className="grid gap-4">
          {needsPool && (
            <p className="text-muted-foreground">
              No truck is reserved for this discharge yet.{' '}
              <DischargeTabLink
                className="font-medium text-foreground underline underline-offset-4"
                tab="truck-pool"
              >
                Go to truck pool
              </DischargeTabLink>
            </p>
          )}
          <ShiftCalendar
            discharge={discharge}
            onSelect={selectShift}
            selectedShiftId={selectedShift.id}
          />
          <ShiftDetail
            canCorrect={canCorrect}
            discharge={discharge}
            onEditTrucks={() => setEditingShiftId(selectedShift.id)}
            shift={selectedShift}
          />
        </div>
      ) : (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No shifts planned</EmptyTitle>
            <EmptyDescription>No shift has been prepared for this discharge yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {canCorrect && editingShift && (
        <ShiftTrucksSheet
          discharge={discharge}
          onOpenChange={(open) => !open && setEditingShiftId(null)}
          open={true}
          period={formatShiftPeriod(editingShift)}
          shift={editingShift}
        />
      )}
    </DetailSection>
  )
}
