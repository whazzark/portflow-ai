import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'

/**
 * Back to the list the discharge was opened from. The detail inherits the list's status and
 * search from its parent route, so keeping them is what restores that exact collection.
 */
export function BackToDischargesLink({
  from = '/discharges/$dischargeId',
}: {
  /** The page the link leaves; both keep the list's status and search. */
  from?: '/discharges/$dischargeId' | '/discharges/new'
}) {
  return (
    <Link
      className={buttonVariants({ className: 'self-start', size: 'sm', variant: 'ghost' })}
      from={from}
      search={(previous) => previous}
      to="/discharges"
    >
      <ArrowLeftIcon aria-hidden="true" />
      Back to discharges
    </Link>
  )
}
