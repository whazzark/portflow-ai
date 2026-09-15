import { lotDoorNotice } from '@/features/discharges/discharge-detail-view'
import { currentTruckIds, heldPoolEntries } from '@/features/discharges/truck-pool-selection'
import {
  DISCHARGE_DETAIL_TABS,
  type DischargeDetailDto,
  type DischargeDetailTab,
} from '@/features/discharges/types'

export function isDischargeDetailTab(value: string): value is DischargeDetailTab {
  return DISCHARGE_DETAIL_TABS.includes(value as DischargeDetailTab)
}

/**
 * The search that opens a section. Overview is the page's default and stays out of the address, so
 * a plain link to a discharge and a link to its overview are the same address.
 */
export function tabSearch(tab: DischargeDetailTab) {
  // The open shift belongs to the shifts section, so leaving for another section, or coming back
  // to it, starts again from its default shift.
  return { tab: tab === 'overview' ? undefined : tab, shiftId: undefined }
}

/**
 * The count beside each section's tab. The truck pool counts the trucks still held, not its
 * history; a closed discharge holds none, so its pool gets no count rather than a misleading zero
 * beside the trucks it once used.
 */
export function detailTabCounts(detail: DischargeDetailDto) {
  return {
    'product-lots': detail.productLots.length,
    'truck-pool': detail.status === 'CLOSED' ? null : heldPoolEntries(detail).length,
    shifts: detail.shifts.length,
  }
}

/**
 * The facts a preparer checks before a discharge starts, and the gaps the specs already name. It
 * deliberately passes no verdict on whether the discharge can start: that rule belongs to the start
 * confirmation.
 */
export function preparationSummary(detail: DischargeDetailDto) {
  return {
    productLots: {
      total: detail.productLots.length,
      withoutCurrentDoor: detail.productLots.filter(
        (lot) => lotDoorNotice(lot, detail.status) !== null,
      ).length,
    },
    truckPool: { held: heldPoolEntries(detail).length },
    shifts: {
      total: detail.shifts.length,
      plannedWithoutTrucks: detail.shifts.filter(
        (shift) => shift.status === 'PLANNED' && currentTruckIds(shift).size === 0,
      ).length,
    },
  }
}
