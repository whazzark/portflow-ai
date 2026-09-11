import { useQuery } from '@tanstack/react-query'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'

// Reads the detail the page reads, so a refetch that renames the vessel renames the crumb along
// with the heading. It never fetches on its own: the loader and the page own that, and a crumb
// over a missing or failed discharge must not ask again. Until a discharge has been read — while
// pending, or when it is missing or failed — the crumb still needs a label.
export function DischargeBreadcrumb({ params }: { params: Record<string, string> }) {
  const dischargeQuery = useQuery({
    ...dischargeQueries.detail(params.dischargeId ?? ''),
    enabled: false,
  })

  return dischargeQuery.data?.data.vesselName ?? 'Discharge'
}
