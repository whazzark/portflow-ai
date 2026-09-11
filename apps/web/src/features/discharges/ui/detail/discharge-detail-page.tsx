import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { BackToDischargesLink } from '@/features/discharges/ui/detail/back-to-discharges-link'
import { DischargeIdentityCard } from '@/features/discharges/ui/detail/discharge-identity-card'
import { DischargeProductLotsCard } from '@/features/discharges/ui/detail/discharge-product-lots-card'
import { DischargeShiftsCard } from '@/features/discharges/ui/detail/discharge-shifts-card'
import { DischargeStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { DischargeTruckPoolCard } from '@/features/discharges/ui/detail/discharge-truck-pool-card'

const dischargeRoute = getRouteApi('/_authenticated/discharges/$dischargeId')

export function DischargeDetailPage() {
  const { dischargeId } = dischargeRoute.useParams()
  const dischargeQuery = useQuery(dischargeQueries.detail(dischargeId))
  const discharge = dischargeQuery.data?.data

  // The loader has already resolved the detail, so this only guards the type.
  if (!discharge) {
    return null
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <BackToDischargesLink />
      {/* Visible, unlike the list's: the breadcrumb names the vessel, but only the heading carries
          the discharge's status beside it. */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-semibold text-2xl">{discharge.vesselName}</h1>
        <DischargeStatusBadge status={discharge.status} />
      </div>
      <DischargeIdentityCard discharge={discharge} />
      <DischargeProductLotsCard discharge={discharge} />
      <DischargeShiftsCard discharge={discharge} />
      <DischargeTruckPoolCard discharge={discharge} />
    </div>
  )
}
