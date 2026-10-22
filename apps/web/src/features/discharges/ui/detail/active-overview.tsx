import type { DischargeDetailDto } from '@/features/discharges/types'
import { ActiveShiftCard } from '@/features/discharges/ui/detail/active-shift-card'
import { VesselComment } from '@/features/discharges/ui/detail/vessel-comment'

type ActiveOverviewProps = {
  discharge: DischargeDetailDto
  /** Whether the viewer may add shifts now: a preparer, on a discharge that is not closed. */
  canAddShifts: boolean
}

/**
 * What is happening now on a started discharge. Its facts stay in the header, so the overview
 * opens on its vessel comment and then on its work.
 */
export function ActiveOverview({ discharge, canAddShifts }: ActiveOverviewProps) {
  return (
    <>
      <VesselComment comment={discharge.vesselComment} />
      <ActiveShiftCard canAddShifts={canAddShifts} discharge={discharge} />
    </>
  )
}
