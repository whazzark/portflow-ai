import type { DischargeDetailDto } from '@/features/discharges/types'
import { VesselComment } from '@/features/discharges/ui/detail/vessel-comment'

type ActiveOverviewProps = {
  discharge: DischargeDetailDto
}

/**
 * What is happening now on a started discharge. Its facts stay in the header, so the overview
 * opens on its vessel comment and then on its work.
 */
export function ActiveOverview({ discharge }: ActiveOverviewProps) {
  return <VesselComment comment={discharge.vesselComment} />
}
