import { useQuery } from '@tanstack/react-query'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { PlanningDoorDto } from '@/features/discharges/types'
import {
  optionsState,
  type PreparationOptions,
} from '@/features/discharges/ui/preparation/preparation-options'

export type PlanningOptions = {
  doors: PreparationOptions<PlanningDoorDto>
  weighingAreas: PreparationOptions<{ id: string; name: string }>
}

/**
 * The doors and weighing areas a planning sheet offers, from one read. Each list reports its own
 * loading and retry, in the same shape as the preparation fields.
 */
export function usePlanningOptions(dischargeId: string): PlanningOptions {
  const query = useQuery(dischargeQueries.planningOptions(dischargeId))

  return {
    doors: optionsState(query, (response) => response.data.warehouseDoors),
    weighingAreas: optionsState(query, (response) => response.data.weighingAreas),
  }
}
