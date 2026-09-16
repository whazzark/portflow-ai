import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { shiftSearch, tabSearch } from '@/features/discharges/discharge-detail-sections'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto, DischargeDetailTab } from '@/features/discharges/types'

type DischargeTabLinkProps = {
  tab: DischargeDetailTab
  children: ReactNode
  className?: string
  onClick?: () => void
}

/** Opens another section of the open discharge, keeping the list state its way back restores. */
export function DischargeTabLink({ tab, children, className, onClick }: DischargeTabLinkProps) {
  return (
    <Link
      className={className}
      from="/discharges/$dischargeId"
      onClick={onClick}
      search={(previous) => ({ ...previous, ...tabSearch(tab) })}
      to="."
    >
      {children}
    </Link>
  )
}

type ShiftLinkProps = {
  shift: Pick<DischargeDetailDto['shifts'][number], 'id' | 'plannedStartAt' | 'plannedEndAt'>
  className?: string
}

/**
 * Opens a shift's panel over the shifts section, named as the calendar names it. Leaving the section
 * it sits in closes whatever sheet holds it, so a sheet is never stacked over another.
 */
export function ShiftLink({ className, shift }: ShiftLinkProps) {
  return (
    <Link
      className={className}
      from="/discharges/$dischargeId"
      search={(previous) => ({ ...previous, ...shiftSearch(shift.id) })}
      to="."
    >
      Shift {formatShiftPeriod(shift)}
    </Link>
  )
}
