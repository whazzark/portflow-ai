import { expect, test } from 'vitest'

import { buildDoorPeriod, buildLot } from '@/features/discharges/__tests__/support/fixtures'
import { correctionRowRemoval } from '@/features/discharges/customer-lots-correction'

test('never removes a lot that has had a warehouse door, even as the last row', () => {
  const doored = buildLot({ doorAssignments: [buildDoorPeriod()] })

  expect(correctionRowRemoval(doored, 0, 1)).toBe('E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS')
  expect(correctionRowRemoval(doored, 3, 2)).toBe('E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS')
})

test('keeps the last row of a discharge whose other customers have no lot', () => {
  expect(correctionRowRemoval(null, 0, 1)).toBe('E_DISCHARGE_LAST_PRODUCT_LOT')
  expect(correctionRowRemoval(buildLot(), 0, 1)).toBe('E_DISCHARGE_LAST_PRODUCT_LOT')
})

test('lets any other row go', () => {
  expect(correctionRowRemoval(buildLot(), 0, 2)).toBeNull()
  expect(correctionRowRemoval(null, 3, 1)).toBeNull()
})
