import { test } from '@japa/runner'
import {
  findBulkBlockers,
  type WarehouseDoorLifecycleRecord,
} from '#warehouse_doors/shared/warehouse_door_lifecycle_blockers'

const AVAILABLE_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f11'
const ARCHIVED_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f12'
const HELD_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f13'
const UNKNOWN_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f14'
const STRANDED_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f15'

const WAREHOUSE_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2fa1'
const ARCHIVED_WAREHOUSE_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2fa2'

const doors = new Map<string, WarehouseDoorLifecycleRecord>([
  [
    AVAILABLE_ID,
    { id: AVAILABLE_ID, name: 'Door 1', status: 'AVAILABLE', warehouseId: WAREHOUSE_ID },
  ],
  [ARCHIVED_ID, { id: ARCHIVED_ID, name: 'Door 2', status: 'ARCHIVED', warehouseId: WAREHOUSE_ID }],
  [HELD_ID, { id: HELD_ID, name: 'Door 3', status: 'AVAILABLE', warehouseId: WAREHOUSE_ID }],
  [
    STRANDED_ID,
    { id: STRANDED_ID, name: 'Door 4', status: 'AVAILABLE', warehouseId: ARCHIVED_WAREHOUSE_ID },
  ],
])

/** Only the containing warehouse that is available; the second one stands for one the write may not
 * touch, which in production is a warehouse the lock read excluded because it is archived. */
const availableWarehouses = new Set([WAREHOUSE_ID])

test.group('Warehouse door bulk lifecycle blockers', () => {
  test('reports an unknown identifier as not found, with no name to give', ({ assert }) => {
    const blockers = findBulkBlockers([UNKNOWN_ID], doors, 'AVAILABLE', availableWarehouses)

    assert.deepEqual(blockers, [{ id: UNKNOWN_ID, reason: 'NOT_FOUND' }])
  })

  test('reports an archived door as already archived, named', ({ assert }) => {
    const blockers = findBulkBlockers([ARCHIVED_ID], doors, 'AVAILABLE', availableWarehouses)

    assert.deepEqual(blockers, [{ id: ARCHIVED_ID, name: 'Door 2', reason: 'ALREADY_ARCHIVED' }])
  })

  test('reports a door the shared usage rule names as in use', ({ assert }) => {
    const blockers = findBulkBlockers(
      [HELD_ID],
      doors,
      'AVAILABLE',
      availableWarehouses,
      new Set([HELD_ID]),
    )

    assert.deepEqual(blockers, [{ id: HELD_ID, name: 'Door 3', reason: 'IN_USE' }])
  })

  test('reports nothing for an eligible door', ({ assert }) => {
    const blockers = findBulkBlockers([AVAILABLE_ID], doors, 'AVAILABLE', availableWarehouses)

    assert.isEmpty(blockers)
  })

  test('keeps the submission order and gives each blocked door exactly one reason', ({
    assert,
  }) => {
    const blockers = findBulkBlockers(
      [HELD_ID, UNKNOWN_ID, AVAILABLE_ID, ARCHIVED_ID],
      doors,
      'AVAILABLE',
      availableWarehouses,
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

  test('reports an available door whose warehouse is archived, named', ({ assert }) => {
    const blockers = findBulkBlockers([STRANDED_ID], doors, 'AVAILABLE', availableWarehouses)

    assert.deepEqual(blockers, [{ id: STRANDED_ID, name: 'Door 4', reason: 'WAREHOUSE_ARCHIVED' }])
  })

  test('answers a door archived with its warehouse "already archived" rather than naming the warehouse', ({
    assert,
  }) => {
    // The warehouse guard sits *after* the status check on purpose: the cascade leaves this door
    // archived, and "already archived" is the reading the administrator can act on.
    const cascaded = new Map(doors).set(STRANDED_ID, {
      id: STRANDED_ID,
      name: 'Door 4',
      status: 'ARCHIVED' as const,
      warehouseId: ARCHIVED_WAREHOUSE_ID,
    })

    const blockers = findBulkBlockers([STRANDED_ID], cascaded, 'AVAILABLE', availableWarehouses)

    assert.deepEqual(blockers, [{ id: STRANDED_ID, name: 'Door 4', reason: 'ALREADY_ARCHIVED' }])
  })

  test('carries the reactivation direction #216 will reuse', ({ assert }) => {
    const blockers = findBulkBlockers([AVAILABLE_ID], doors, 'ARCHIVED', availableWarehouses)

    assert.deepEqual(blockers, [{ id: AVAILABLE_ID, name: 'Door 1', reason: 'ALREADY_AVAILABLE' }])
  })
})
