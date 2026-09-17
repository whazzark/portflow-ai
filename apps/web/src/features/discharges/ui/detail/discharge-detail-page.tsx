import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useRef } from 'react'

import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { tabSearch } from '@/features/discharges/discharge-detail-sections'
import { canAddShifts, canPrepareDischarges } from '@/features/discharges/discharge-permissions'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { DischargeDetailTab } from '@/features/discharges/types'
import { DischargeDetailHeader } from '@/features/discharges/ui/detail/discharge-detail-header'
import { DischargeDetailTabs } from '@/features/discharges/ui/detail/discharge-detail-tabs'
import { EditDischargeAction } from '@/features/discharges/ui/detail/edit-discharge-action'
import { StartDischargeAction } from '@/features/discharges/ui/start/start-discharge-action'

const dischargeRoute = getRouteApi('/_authenticated/discharges/$dischargeId')

export function DischargeDetailPage() {
  const { dischargeId } = dischargeRoute.useParams()
  const { tab = 'overview' } = dischargeRoute.useSearch()
  const navigate = dischargeRoute.useNavigate()
  const dischargeQuery = useQuery(dischargeQueries.detail(dischargeId))
  const discharge = dischargeQuery.data?.data
  const user = useAuthenticatedUser()
  const canPrepare = canPrepareDischarges(user)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The loader has already resolved the detail, so this only guards the type.
  if (!discharge) {
    return null
  }

  // Corrections exist only before the discharge starts; after that, the detail is read-only.
  const canCorrect = canPrepare && discharge.status === 'PLANNED'

  // Pushed, as the list's status tabs are: each section is a place the user can return to.
  const openTab = (nextTab: DischargeDetailTab) => {
    void navigate({ search: (previous) => ({ ...previous, ...tabSearch(nextTab) }) })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DischargeDetailHeader
        actions={
          canCorrect ? (
            <>
              <EditDischargeAction discharge={discharge} />
              <StartDischargeAction
                discharge={discharge}
                onStarted={() => headingRef.current?.focus()}
              />
            </>
          ) : undefined
        }
        discharge={discharge}
        headingRef={headingRef}
      />
      <DischargeDetailTabs
        canAddShifts={canAddShifts(user, discharge)}
        canCorrect={canCorrect}
        discharge={discharge}
        onTabChange={openTab}
        tab={tab}
      />
    </div>
  )
}
