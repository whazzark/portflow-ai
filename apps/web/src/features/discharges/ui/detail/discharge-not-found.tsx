import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { BackToDischargesLink } from '@/features/discharges/ui/detail/back-to-discharges-link'

/**
 * No discharge has this address. Nothing here is retryable, so unlike a failed retrieval this
 * offers no retry: only the way back.
 */
export function DischargeNotFound() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <BackToDischargesLink />
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Discharge not found</EmptyTitle>
          <EmptyDescription>
            This address does not refer to any discharge of the site. Its link may be mistyped or
            incomplete.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
