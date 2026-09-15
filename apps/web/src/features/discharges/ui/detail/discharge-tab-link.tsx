import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { tabSearch } from '@/features/discharges/discharge-detail-sections'
import type { DischargeDetailTab } from '@/features/discharges/types'

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
