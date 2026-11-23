import { ShipIcon } from 'lucide-react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '@/components/ui/empty'
import { BackToDischargesLink } from '@/features/discharges/ui/detail/back-to-discharges-link'

/**
 * No discharge has this address. Nothing here is retryable, so unlike a failed retrieval this
 * offers no retry: only the way back, as the page's one action.
 */
export function DischargeNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 md:p-6">
      {/* Raised a little above the true center, which reads as sitting low under the header. */}
      <Empty className="max-w-md flex-none gap-3.5 p-0 md:-mt-20">
        <EmptyHeader className="max-w-none gap-3.5">
          <EmptyMedia className="mb-0 size-14 rounded-2xl bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-6.5">
            <ShipIcon aria-hidden="true" />
          </EmptyMedia>
          <h1 className="font-heading font-semibold text-xl">Discharge not found</h1>
          <EmptyDescription>
            This address does not refer to any discharge of the site. Its link may be mistyped or
            incomplete.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="mt-1.5">
          <BackToDischargesLink primary />
        </EmptyContent>
      </Empty>
    </div>
  )
}
