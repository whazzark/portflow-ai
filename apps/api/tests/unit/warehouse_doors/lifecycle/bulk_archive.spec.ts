import { test } from '@japa/runner'
import {
  findBulkBlockers,
  type WarehouseDoorLifecycleRecord,
} from '#warehouse_doors/shared/warehouse_door_lifecycle_blockers'

const AVAILABLE_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f11'
const ARCHIVED_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f12'
const HELD_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f13'
const UNKNOWN_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f14'

const doors = new Map<string, WarehouseDoorLifecycleRecord>([
  [AVAILABLE_ID, { id: AVAILABLE_ID, name: 'Door 1', status: 'AVAILABLE' }],
  [ARCHIVED_ID, { id: ARCHIVED_ID, name: 'Door 2', status: 'ARCHIVED' }],
  [HELD_ID, { id: HELD_ID, name: 'Door 3', status: 'AVAILABLE' }],
])

test.group('Warehouse door bulk lifecycle blockers', () => {
  test('reports an unknown identifier as not found, with no name to give', ({ assert }) => {
    const blockers = findBulkBlockers([UNKNOWN_ID], doors, 'AVAILABLE')

    assert.deepEqual(blockers, [{ id: UNKNOWN_ID, reason: 'NOT_FOUND' }])
  })

  test('reports an archived door as already archived, named', ({ assert }) => {
    const blockers = findBulkBlockers([ARCHIVED_ID], doors, 'AVAILABLE')

    assert.deepEqual(blockers, [{ id: ARCHIVED_ID, name: 'Door 2', reason: 'ALREADY_ARCHIVED' }])
  })

  test('reports a door the shared usage rule names as in use', ({ assert }) => {
    const blockers = findBulkBlockers([HELD_ID], doors, 'AVAILABLE', new Set([HELD_ID]))

    assert.deepEqual(blockers, [{ id: HELD_ID, name: 'Door 3', reason: 'IN_USE' }])
  })

  test('reports nothing for an eligible door', ({ assert }) => {
    const blockers = findBulkBlockers([AVAILABLE_ID], doors, 'AVAILABLE')

    assert.isEmpty(blockers)
  })

  test('keeps the submission order and gives each blocked door exactly one reason', ({
    assert,
  }) => {
    const blockers = findBulkBlockers(
      [HELD_ID, UNKNOWN_ID, AVAILABLE_ID, ARCHIVED_ID],
      doors,
      'AVAILABLE',
      new Set([HELD_ID]),
    )

    assert.deepEqual(
      blockers.map((blocker) => [blocker.id, blocker.reason]),
      [
        [HELD_ID, 'IN_USE'],
        [UNKNOWN_ID, 'NOT_FOUND'],
        [ARCHIVED_ID, 'ALREADY_ARCHIVED'],
      ],
    )
  })

  test('carries the reactivation direction #216 will reuse', ({ assert }) => {
    const blockers = findBulkBlockers([AVAILABLE_ID], doors, 'ARCHIVED')

    assert.deepEqual(blockers, [{ id: AVAILABLE_ID, name: 'Door 1', reason: 'ALREADY_AVAILABLE' }])
  })
})
