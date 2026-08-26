import { describe, expect, test } from 'vitest'
import {
  countAvailableDoors,
  countAvailableDoorsIn,
  countRestorableDoors,
  countRestorableDoorsIn,
  describeBulkDoorCascade,
  describeBulkWarehouseEffect,
  describeDoorCascade,
  describeDoorRestore,
  toBulkWarehouseLifecycleOutcome,
} from '@/features/warehouses/warehouse-lifecycle'
import { MIXED_ARCHIVED_WAREHOUSE, WAREHOUSES } from './support/fixtures'

describe('warehouse bulk lifecycle adapter', () => {
  test('maps the bulk result onto the shared outcome shape', () => {
    expect(
      toBulkWarehouseLifecycleOutcome({
        updatedWarehouses: [WAREHOUSES[0], WAREHOUSES[1]],
        blockedWarehouses: [{ id: 'a', name: 'Busy Shed', reason: 'IN_USE' }],
      } as never),
    ).toEqual({
      updatedCount: 2,
      blocked: [{ id: 'a', name: 'Busy Shed', reason: 'IN_USE' }],
    })
  })

  test('reports an all-blocked submission as zero updated', () => {
    expect(
      toBulkWarehouseLifecycleOutcome({
        updatedWarehouses: [],
        blockedWarehouses: [
          { id: 'a', reason: 'NOT_FOUND' },
          { id: 'b', name: 'Retired Shed', reason: 'ALREADY_ARCHIVED' },
        ],
      } as never).updatedCount,
    ).toBe(0)
  })
})

describe('door cascade counting', () => {
  test('counts only available doors of one warehouse', () => {
    // North Shed holds one available door and one already archived door.
    expect(countAvailableDoors(WAREHOUSES[0])).toBe(1)
    // Retired Shed's only door is already archived.
    expect(countAvailableDoors(WAREHOUSES[1])).toBe(0)
  })

  test('sums available doors across a selection', () => {
    expect(countAvailableDoorsIn(WAREHOUSES)).toBe(1)
    expect(countAvailableDoorsIn([])).toBe(0)
  })

  test('tolerates a warehouse whose doors were not embedded', () => {
    expect(countAvailableDoors({ ...WAREHOUSES[0], doors: undefined })).toBe(0)
  })

  test('describes the single cascade in agreeing numbers', () => {
    expect(describeDoorCascade(0)).toContain('no available door')
    expect(describeDoorCascade(1)).toContain('1 available door is archived')
    expect(describeDoorCascade(3)).toContain('3 available doors are archived')
  })

  test('describes the bulk cascade in agreeing numbers', () => {
    expect(describeBulkDoorCascade(1, 1)).toContain('1 available door is archived')
    expect(describeBulkDoorCascade(3, 0)).toContain('no available door')
    expect(describeBulkDoorCascade(2, 5)).toContain('5 available doors are archived')
  })

  // Asserted as whole sentences: the counts vary independently, and a `toContain` on the noun
  // phrase alone still passes while the verb around it disagrees.
  test('keeps every clause agreeing when either count is one or zero', () => {
    expect(describeBulkWarehouseEffect('archive', 3, 0)).toBe(
      'These 3 warehouses remain readable but are no longer available for new operations. They have no available door to archive with them.',
    )
    expect(describeBulkWarehouseEffect('archive', 1, 0)).toBe(
      'This 1 warehouse remains readable but is no longer available for new operations. It has no available door to archive with it.',
    )
    expect(describeBulkWarehouseEffect('archive', 1, 1)).toBe(
      'This 1 warehouse remains readable but is no longer available for new operations. Its 1 available door is archived with it.',
    )
    expect(describeBulkWarehouseEffect('archive', 2, 5)).toBe(
      'These 2 warehouses remain readable but are no longer available for new operations. Their 5 available doors are archived with them.',
    )
  })
})

describe('door restore counting', () => {
  test('counts only the doors archived with their warehouse', () => {
    // Mixed Shed holds one door archived by the cascade and one archived on its own.
    expect(countRestorableDoors(MIXED_ARCHIVED_WAREHOUSE)).toBe(1)
    // Retired Shed's only door came down with the building.
    expect(countRestorableDoors(WAREHOUSES[1])).toBe(1)
  })

  // An available door never carries a live cascade record, so it must not be counted as returning
  // to service — it never left.
  test('ignores available doors even if they still carry a stale record', () => {
    expect(
      countRestorableDoors({
        ...WAREHOUSES[1],
        doors: WAREHOUSES[1].doors?.map((door) => ({ ...door, status: 'AVAILABLE' as const })),
      }),
    ).toBe(0)
  })

  test('counts nothing for a warehouse with no cascaded door', () => {
    expect(countRestorableDoors(WAREHOUSES[0])).toBe(0)
    expect(countRestorableDoors({ ...WAREHOUSES[0], doors: undefined })).toBe(0)
  })

  test('sums restorable doors across a selection', () => {
    expect(countRestorableDoorsIn([MIXED_ARCHIVED_WAREHOUSE, WAREHOUSES[1]])).toBe(2)
    expect(countRestorableDoorsIn([])).toBe(0)
  })

  test('describes the single restore in agreeing numbers', () => {
    expect(describeDoorRestore(0)).toContain('No door returns to service')
    expect(describeDoorRestore(1)).toContain('Its 1 door archived with it returns to service')
    expect(describeDoorRestore(3)).toContain('Its 3 doors archived with it return to service')
  })

  test('keeps every bulk restore clause agreeing when either count is one or zero', () => {
    expect(describeBulkWarehouseEffect('reactivate', 3, 0)).toBe(
      'These 3 warehouses become available again for new operations. No door returns to service with them.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 1, 0)).toBe(
      'This 1 warehouse becomes available again for new operations. No door returns to service with it.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 1, 1)).toBe(
      'This 1 warehouse becomes available again for new operations. Its 1 door archived with it returns to service.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 3, 1)).toBe(
      'These 3 warehouses become available again for new operations. Their 1 door archived with them returns to service.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 2, 5)).toBe(
      'These 2 warehouses become available again for new operations. Their 5 doors archived with them return to service.',
    )
  })
})
