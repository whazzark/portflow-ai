import { describe, expect, test } from 'vitest'
import {
  countDoors,
  countDoorsIn,
  describeBulkDoorCascade,
  describeBulkWarehouseEffect,
  describeDoorCascade,
  describeDoorRestore,
  toBulkWarehouseLifecycleOutcome,
} from '@/features/warehouses/warehouse-lifecycle'
import { TWO_DOOR_ARCHIVED_WAREHOUSE, WAREHOUSES } from './support/fixtures'

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
  // Every door counts, whatever its own status: the archival takes all of them, and the one
  // already archived is taken over by it rather than skipped.
  test('counts every door of one warehouse', () => {
    // North Shed holds one available door and one already archived door.
    expect(countDoors(WAREHOUSES[0])).toBe(2)
    // Retired Shed holds one door.
    expect(countDoors(WAREHOUSES[1])).toBe(1)
  })

  test('sums doors across a selection', () => {
    expect(countDoorsIn(WAREHOUSES)).toBe(3)
    expect(countDoorsIn([])).toBe(0)
  })

  test('tolerates a warehouse whose doors were not embedded', () => {
    expect(countDoors({ ...WAREHOUSES[0], doors: undefined })).toBe(0)
  })

  test('describes the single cascade in agreeing numbers', () => {
    expect(describeDoorCascade(0)).toContain('no door')
    expect(describeDoorCascade(1)).toContain('Its 1 door is archived')
    expect(describeDoorCascade(3)).toContain('Its 3 doors are archived')
  })

  test('describes the bulk cascade in agreeing numbers', () => {
    expect(describeBulkDoorCascade(1, 1)).toContain('1 door is archived')
    expect(describeBulkDoorCascade(3, 0)).toContain('no door')
    expect(describeBulkDoorCascade(2, 5)).toContain('5 doors are archived')
  })

  // Asserted as whole sentences: the counts vary independently, and a `toContain` on the noun
  // phrase alone still passes while the verb around it disagrees.
  test('keeps every clause agreeing when either count is one or zero', () => {
    expect(describeBulkWarehouseEffect('archive', 3, 0)).toBe(
      'These 3 warehouses remain readable but are no longer available for new operations. They have no door to archive with them.',
    )
    expect(describeBulkWarehouseEffect('archive', 1, 0)).toBe(
      'This 1 warehouse remains readable but is no longer available for new operations. It has no door to archive with it.',
    )
    expect(describeBulkWarehouseEffect('archive', 1, 1)).toBe(
      'This 1 warehouse remains readable but is no longer available for new operations. Its 1 door is archived with it.',
    )
    expect(describeBulkWarehouseEffect('archive', 2, 5)).toBe(
      'These 2 warehouses remain readable but are no longer available for new operations. Their 5 doors are archived with them.',
    )
  })
})

describe('door restore counting', () => {
  // The reactivation is the archival's mirror, so it restores every door the warehouse holds —
  // including one that had been retired on its own before the building took it over.
  test('counts every door of an archived warehouse', () => {
    // Mixed Shed holds two archived doors; both come back with it.
    expect(countDoors(TWO_DOOR_ARCHIVED_WAREHOUSE)).toBe(2)
    expect(countDoors(WAREHOUSES[1])).toBe(1)
  })

  test('counts nothing for a warehouse whose doors were not embedded', () => {
    expect(countDoors({ ...WAREHOUSES[0], doors: undefined })).toBe(0)
  })

  test('sums doors across a selection', () => {
    expect(countDoorsIn([TWO_DOOR_ARCHIVED_WAREHOUSE, WAREHOUSES[1]])).toBe(3)
    expect(countDoorsIn([])).toBe(0)
  })

  test('describes the single restore in agreeing numbers', () => {
    expect(describeDoorRestore(0)).toContain('No door returns to service')
    expect(describeDoorRestore(1)).toContain('Its 1 door returns to service')
    expect(describeDoorRestore(3)).toContain('Its 3 doors return to service')
  })

  test('keeps every bulk restore clause agreeing when either count is one or zero', () => {
    expect(describeBulkWarehouseEffect('reactivate', 3, 0)).toBe(
      'These 3 warehouses become available again for new operations. No door returns to service with them.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 1, 0)).toBe(
      'This 1 warehouse becomes available again for new operations. No door returns to service with it.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 1, 1)).toBe(
      'This 1 warehouse becomes available again for new operations. Its 1 door returns to service.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 3, 1)).toBe(
      'These 3 warehouses become available again for new operations. Their 1 door returns to service.',
    )
    expect(describeBulkWarehouseEffect('reactivate', 2, 5)).toBe(
      'These 2 warehouses become available again for new operations. Their 5 doors return to service.',
    )
  })
})
