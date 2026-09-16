import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { LOT_GONE_MESSAGE } from '@/features/discharges/ui/detail/product-lot-sheet'

export const SHIFT_GONE_MESSAGE = 'This shift can no longer be planned'
export const PLANNING_CONFLICT_MESSAGE =
  'This discharge changed meanwhile. Check its doors and try again.'

const STALE_MESSAGES: Record<string, string> = {
  E_DISCHARGE_NOT_PLANNED: STARTED_REFUSAL_MESSAGE,
  E_DISCHARGE_NOT_FOUND: STARTED_REFUSAL_MESSAGE,
  E_PRODUCT_LOT_NOT_FOUND: LOT_GONE_MESSAGE,
  E_SHIFT_NOT_FOUND: SHIFT_GONE_MESSAGE,
  E_SHIFT_NOT_PLANNED: SHIFT_GONE_MESSAGE,
  E_DISCHARGE_PLANNING_CONFLICT: PLANNING_CONFLICT_MESSAGE,
}

/**
 * The reason a planning save was refused because the discharge moved on — it started, or its lot
 * or shift is gone, or someone changed the same door first. The sheet on screen is stale then, so
 * it closes and the detail is fetched again; `null` for any other refusal.
 */
export function staleRefusalMessage(code: string | undefined) {
  return (code && STALE_MESSAGES[code]) ?? null
}
