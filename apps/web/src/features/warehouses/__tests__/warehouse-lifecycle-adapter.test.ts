import { describe, expect, test } from 'vitest'
import {
  countAvailableDoors,
  describeDoorCascade,
} from '@/features/warehouses/ui/warehouse-lifecycle-actions'
import {
  countAvailableDoorsIn,
  describeBulkDoorCascade,
  toBulkLifecycleOutcome,
} from '@/features/warehouses/warehouse-lifecycle-adapter'
import { WAREHOUSES } from './support/fixtures'

describe('warehouse bulk lifecycle adapter', () => {
  test('maps the bulk result onto the shared outcome shape', () => {
    expect(
      toBulkLifecycleOutcome({
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
      toBulkLifecycleOutcome({
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
    expect(describeBulkDoorCascade(1, 1)).toContain('1 warehouse')
    expect(describeBulkDoorCascade(1, 1)).toContain('1 available door is archived')
    expect(describeBulkDoorCascade(3, 0)).toContain('3 warehouses')
    expect(describeBulkDoorCascade(3, 0)).toContain('no available door')
    expect(describeBulkDoorCascade(2, 5)).toContain('5 available doors are archived')
  })

  // Asserted as whole sentences: the counts vary independently, and a `toContain` on the noun
  // phrase alone still passes while the verb around it disagrees.
  test('keeps every clause agreeing when either count is one or zero', () => {
    expect(describeBulkDoorCascade(3, 0)).toBe(
      'These 3 warehouses remain readable but are no longer selectable for new operational work. They have no available door to archive with them.',
    )
    expect(describeBulkDoorCascade(1, 0)).toBe(
      'This 1 warehouse remains readable but is no longer selectable for new operational work. It has no available door to archive with it.',
    )
    expect(describeBulkDoorCascade(1, 1)).toBe(
      'This 1 warehouse remains readable but is no longer selectable for new operational work. Its 1 available door is archived with it.',
    )
    expect(describeBulkDoorCascade(2, 5)).toBe(
      'These 2 warehouses remain readable but are no longer selectable for new operational work. Their 5 available doors are archived with them.',
    )
  })
})
