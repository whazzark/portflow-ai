import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDto } from '@/features/discharges/types'

type ListedShift = NonNullable<DischargeDto['activeShift']>

function ShiftLines({ label, shift }: { label: string; shift: ListedShift }) {
  return (
    <>
      <span>{label}</span>
      <span className="text-muted-foreground text-xs">{formatShiftPeriod(shift)}</span>
      <span>
        {shift.responsible.firstName} {shift.responsible.lastName}
      </span>
    </>
  )
}

type DischargeShiftCellProps = {
  discharge: DischargeDto
}

/**
 * Who is running an active discharge now. Between two shifts none is in progress, and the cell
 * says so before naming the next one, rather than presenting a planned shift as running.
 */
export function DischargeShiftCell({ discharge }: DischargeShiftCellProps) {
  const { activeShift, nextShift, shiftCount } = discharge

  if (activeShift) {
    return (
      <span className="flex flex-col">
        <ShiftLines label={`Shift ${activeShift.sequence} / ${shiftCount}`} shift={activeShift} />
      </span>
    )
  }

  return (
    <span className="flex flex-col">
      <span className="text-muted-foreground italic">No shift in progress</span>
      {nextShift && (
        <ShiftLines label={`Next: Shift ${nextShift.sequence} / ${shiftCount}`} shift={nextShift} />
      )}
    </span>
  )
}
