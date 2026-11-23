import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { problemTabs, tabSearch } from '@/features/discharges/discharge-detail-sections'
import { canAddShifts, canPrepareDischarges } from '@/features/discharges/discharge-permissions'
import { startProblemSections } from '@/features/discharges/discharge-start-view'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { DischargeDetailTab } from '@/features/discharges/types'
import { DischargeDetailHeader } from '@/features/discharges/ui/detail/discharge-detail-header'
import { DischargeDetailTabs } from '@/features/discharges/ui/detail/discharge-detail-tabs'
import { EditDischargeAction } from '@/features/discharges/ui/detail/edit-discharge-action'
import { StartBlockersBanner } from '@/features/discharges/ui/detail/start-blockers-banner'
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
  const queryClient = useQueryClient()
  const [startOpen, setStartOpen] = useState(false)
  // Asked only of a planned discharge, and only for someone who may start it, as the API allows.
  // A failure leaves the page as it was: the start confirmation reports its own.
  const startCheck = useQuery({
    ...dischargeQueries.startBlockers(dischargeId),
    enabled: discharge?.status === 'PLANNED' && canPrepare,
  })

  // The loader has already resolved the detail, so this only guards the type.
  if (!discharge) {
    return null
  }

  // Corrections exist only before the discharge starts; after that, the detail is read-only.
  const canCorrect = canPrepare && discharge.status === 'PLANNED'
  const problems = canCorrect && startCheck.isSuccess ? startCheck.data.data.problems : []
  const tabsWithProblems = problemTabs(startProblemSections(problems, discharge))

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
                onOpenChange={(open) => {
                  setStartOpen(open)
                  // What the confirmation found may be newer than what the banner shows.
                  if (!open) {
                    void queryClient.invalidateQueries({
                      queryKey: dischargeQueries.startBlockers(dischargeId).queryKey,
                    })
                  }
                }}
                onStarted={() => headingRef.current?.focus()}
                open={startOpen}
              />
            </>
          ) : undefined
        }
        comment={
          // The comment is context for the plan as a whole, so it stays with the overview.
          discharge.status === 'PLANNED' && tab === 'overview'
            ? discharge.vesselComment?.trim()
            : null
        }
        discharge={discharge}
        headingRef={headingRef}
      />
      {problems.length > 0 && (
        <StartBlockersBanner count={problems.length} onReview={() => setStartOpen(true)} />
      )}
      <DischargeDetailTabs
        canAddShifts={canAddShifts(user, discharge)}
        canCorrect={canCorrect}
        discharge={discharge}
        onTabChange={openTab}
        problemTabs={tabsWithProblems}
        tab={tab}
      />
    </div>
  )
}
