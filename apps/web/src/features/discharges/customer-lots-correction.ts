import type { LotRemovalBlock } from '@/features/discharges/discharge-detail-view'

/**
 * Why a row of a customer's correction cannot be removed, known before saving, in the API's own
 * refusal codes. `lot` is the lot the row corrects, `null` for a row the correction adds; the rows
 * of the correction and the discharge's other lots decide whether one lot would be left.
 */
export function correctionRowRemoval(
  lot: { doorAssignments: unknown[] } | null,
  otherLotCount: number,
  rowCount: number,
): LotRemovalBlock | null {
  if (lot && lot.doorAssignments.length > 0) {
    return 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS'
  }

  return otherLotCount === 0 && rowCount <= 1 ? 'E_DISCHARGE_LAST_PRODUCT_LOT' : null
}
