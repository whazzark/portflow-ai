import { getRouteApi } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import type { DrawnShiftPeriod } from '@/features/discharges/discharge-preparation-schema'
import { openShift } from '@/features/discharges/shift-calendar'
import { heldPoolEntries } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { AddShiftSheet } from '@/features/discharges/ui/detail/add-shift-sheet'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { ShiftCalendar } from '@/features/discharges/ui/detail/shift-calendar'
import { ShiftPanel } from '@/features/discharges/ui/detail/shift-panel'

const dischargeRoute = getRouteApi('/_authenticated/discharges/$dischargeId')

type DischargeShiftsCardProps = {
  discharge: DischargeDetailDto
  /** A preparer on a planned discharge may choose each planned shift's trucks. */
  canCorrect?: boolean
  /** A preparer may add shifts to a discharge that is not closed. */
  canAddShifts?: boolean
}

export function DischargeShiftsCard({
  canAddShifts = false,
  canCorrect = false,
  discharge,
}: DischargeShiftsCardProps) {
  // Open with the period drawn on the calendar, if the addition started there.
  const [adding, setAdding] = useState<{ period?: DrawnShiftPeriod } | null>(null)
  const { shiftId } = dischargeRoute.useSearch()
  const navigate = dischargeRoute.useNavigate()
  const openedShift = openShift(discharge.shifts, shiftId)
  // A shift's trucks come from the pool, so an empty pool leaves a preparer nothing to select.
  const needsPool =
    canCorrect &&
    heldPoolEntries(discharge).length === 0 &&
    discharge.shifts.some((shift) => shift.status === 'PLANNED')

  // Replaced rather than pushed: opening, changing, or closing the panel is not a place to go back
  // to, and the page keeps its scroll position behind the panel.
  const showShift = (nextShiftId: string | undefined) => {
    void navigate({
      search: (previous) => ({ ...previous, shiftId: nextShiftId }),
      replace: true,
      resetScroll: false,
    })
  }

  const addButton = (
    <Button onClick={() => setAdding({})} size="sm">
      <PlusIcon aria-hidden="true" />
      Add shift
    </Button>
  )

  return (
    <DetailSection actions={canAddShifts ? addButton : undefined} title="Shifts">
      {discharge.shifts.length > 0 ? (
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
            onDraw={canAddShifts ? (period) => setAdding({ period }) : undefined}
            onSelect={showShift}
            selectedShiftId={openedShift?.id ?? null}
          />
        </div>
      ) : (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No shifts planned</EmptyTitle>
            <EmptyDescription>No shift has been prepared for this discharge yet.</EmptyDescription>
          </EmptyHeader>
          {canAddShifts && <EmptyContent>{addButton}</EmptyContent>}
        </Empty>
      )}
      <ShiftPanel
        canCorrect={canCorrect}
        discharge={discharge}
        onClose={() => showShift(undefined)}
        shift={openedShift}
      />
      {canAddShifts && (
        <AddShiftSheet
          discharge={discharge}
          onAdded={showShift}
          onOpenChange={(open) => {
            if (!open) {
              setAdding(null)
            }
          }}
          open={adding !== null}
          period={adding?.period}
        />
      )}
    </DetailSection>
  )
}
