import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  listOverlapIssues,
  planLotDoorChanges,
  planShiftCheckpointChanges,
  recordedInstant,
} from '#discharges/shared/discharge_resource_planning_rules'
import { isCurrentRowConflict } from '#discharges/shared/repositories/lucid_discharge_preparation_repository'

test.group('Discharge resource planning recorded instant', () => {
  const now = DateTime.fromISO('2026-09-15T10:20:30.456+02:00', { setZone: true })
  const second = DateTime.utc(2026, 9, 15, 8, 20, 30)

  test('truncates the server time to the second, in UTC', ({ assert }) => {
    const instant = recordedInstant(now, null)

    assert.equal(instant.toISO(), second.toISO())
    assert.equal(instant.zoneName, 'UTC')
  })

  test('keeps the server time when everything recorded is older', ({ assert }) => {
    const instant = recordedInstant(now, second.minus({ seconds: 1 }))

    assert.equal(instant.toISO(), second.toISO())
  })

  test('moves one second past a time already recorded in the same second or later', ({
    assert,
  }) => {
    assert.equal(recordedInstant(now, second).toISO(), second.plus({ seconds: 1 }).toISO())
    assert.equal(
      recordedInstant(now, second.plus({ seconds: 1 })).toISO(),
      second.plus({ seconds: 2 }).toISO(),
    )
  })
})

test.group('Current planning row conflicts', () => {
  test('recognizes a current-row index violation on either engine', ({ assert }) => {
    assert.isTrue(
      isCurrentRowConflict({
        code: '23505',
        constraint: 'warehouse_door_product_lot_assignments_current_door_unique',
      }),
    )
    assert.isTrue(
      isCurrentRowConflict({
        code: 'SQLITE_CONSTRAINT_UNIQUE',
        message:
          'insert into `shift_weighing_areas` … - UNIQUE constraint failed: shift_weighing_areas.shift_id, shift_weighing_areas.weighing_area_id',
      }),
    )
  })

  test('rejects every other database error', ({ assert }) => {
    assert.isFalse(
      isCurrentRowConflict({ code: '23505', constraint: 'product_lots_identity_unique' }),
    )
    assert.isFalse(
      isCurrentRowConflict({
        code: 'SQLITE_CONSTRAINT_UNIQUE',
        message:
          'UNIQUE constraint failed: warehouse_door_product_lot_assignments.discharge_id, warehouse_door_product_lot_assignments.warehouse_door_id, warehouse_door_product_lot_assignments.product_lot_id, warehouse_door_product_lot_assignments.effective_from',
      }),
    )
    assert.isFalse(isCurrentRowConflict(new Error('boom')))
    assert.isFalse(isCurrentRowConflict(null))
  })
})

const available = (...ids: string[]) =>
  new Map(
    ids.map((id) => [
      id,
      { id, status: 'AVAILABLE' as const, warehouseStatus: 'AVAILABLE' as const },
    ]),
  )

test.group('Lot door change plan', () => {
  const LOT = 'lot-wheat'
  const OTHER_LOT = 'lot-barley'
  const current = [
    { id: 'row-a1', productLotId: LOT, warehouseDoorId: 'door-a1' },
    { id: 'row-b1', productLotId: OTHER_LOT, warehouseDoorId: 'door-b1' },
  ]
  const doorsById = available('door-a1', 'door-b1', 'door-c1')

  test('starts a free door and leaves a door already on the lot as it is', ({ assert }) => {
    const plan = planLotDoorChanges({
      lotId: LOT,
      assign: ['door-a1', 'door-c1'],
      withdraw: [],
      currentAssignments: current,
      doorsById,
      plannedShiftDoorIds: [],
    })

    assert.deepEqual(plan, { end: [], start: ['door-c1'], moves: [], issues: [] })
  })

  test('moves a door held by another lot of the discharge', ({ assert }) => {
    const plan = planLotDoorChanges({
      lotId: LOT,
      assign: ['door-b1'],
      withdraw: [],
      currentAssignments: current,
      doorsById,
      plannedShiftDoorIds: [],
    })

    assert.deepEqual(plan, {
      end: ['row-b1'],
      start: ['door-b1'],
      moves: [{ doorId: 'door-b1', fromLotId: OTHER_LOT }],
      issues: [],
    })
  })

  test('ends a door on the lot, and ignores one the lot does not hold', ({ assert }) => {
    const plan = planLotDoorChanges({
      lotId: LOT,
      assign: [],
      withdraw: ['door-a1', 'door-b1', 'door-z9'],
      currentAssignments: current,
      doorsById,
      plannedShiftDoorIds: [],
    })

    assert.deepEqual(plan, { end: ['row-a1'], start: [], moves: [], issues: [] })
  })

  test('compares identities without regard to case', ({ assert }) => {
    const plan = planLotDoorChanges({
      lotId: LOT.toUpperCase(),
      assign: ['DOOR-A1'],
      withdraw: [],
      currentAssignments: current,
      doorsById,
      plannedShiftDoorIds: [],
    })

    assert.deepEqual(plan.start, [])
  })

  test('reports an identity listed in both lists at its position in the second', ({ assert }) => {
    assert.deepEqual(
      listOverlapIssues({ first: ['a', 'b'], second: ['c', 'B'], field: 'withdraw' }),
      [
        {
          field: 'withdraw.1',
          // biome-ignore lint/security/noSecrets: rule name, not a secret
          rule: 'notInBothLists',
          message: 'This identity is also listed to be added',
        },
      ],
    )
  })
})

test.group('Shift checkpoint change plan', () => {
  const assignedDoorIds = ['door-a1', 'door-b1']
  const areasById = new Map(
    ['area-north', 'area-south'].map((id) => [id, { id, status: 'AVAILABLE' as const }]),
  )
  const selections = {
    warehouseDoors: [{ id: 'sel-door-a1', shiftId: 'shift-1', warehouseDoorId: 'door-a1' }],
    weighingAreas: [{ id: 'sel-area-north', shiftId: 'shift-1', weighingAreaId: 'area-north' }],
  }

  test('starts new resources and leaves the ones already on the shift', ({ assert }) => {
    const plan = planShiftCheckpointChanges({
      warehouseDoors: { add: ['door-a1', 'door-b1'], remove: [] },
      weighingAreas: { add: ['AREA-NORTH', 'area-south'], remove: [] },
      currentSelections: selections,
      assignedDoorIds,
      areasById,
    })

    assert.deepEqual(plan, {
      endDoors: [],
      startDoors: ['door-b1'],
      endAreas: [],
      startAreas: ['area-south'],
      issues: [],
    })
  })

  test('ends current resources and ignores ones the shift does not have', ({ assert }) => {
    const plan = planShiftCheckpointChanges({
      warehouseDoors: { add: [], remove: ['door-a1', 'door-z9'] },
      weighingAreas: { add: [], remove: ['area-south'] },
      currentSelections: selections,
      assignedDoorIds,
      areasById,
    })

    assert.deepEqual(plan, {
      endDoors: ['sel-door-a1'],
      startDoors: [],
      endAreas: [],
      startAreas: [],
      issues: [],
    })
  })
})

test.group('Planning refusals', () => {
  test('refuses every assigned door that is unknown, archived, or in an archived warehouse', ({
    assert,
  }) => {
    const plan = planLotDoorChanges({
      lotId: 'lot-wheat',
      assign: ['door-ok', 'door-archived', 'door-closed', 'door-unknown'],
      withdraw: [],
      currentAssignments: [],
      doorsById: new Map([
        ['door-ok', { id: 'door-ok', status: 'AVAILABLE', warehouseStatus: 'AVAILABLE' }],
        [
          'door-archived',
          { id: 'door-archived', status: 'ARCHIVED', warehouseStatus: 'AVAILABLE' },
        ],
        ['door-closed', { id: 'door-closed', status: 'AVAILABLE', warehouseStatus: 'ARCHIVED' }],
      ]),
      plannedShiftDoorIds: [],
    })

    assert.deepEqual(
      plan.issues.map((issue) => [issue.field, issue.rule]),
      [
        ['assign.1', 'availableWarehouseDoor'],
        ['assign.2', 'availableWarehouseDoor'],
        ['assign.3', 'availableWarehouseDoor'],
      ],
    )
  })

  test('refuses to withdraw a door of the lot that a planned shift selects, but not to move it', ({
    assert,
  }) => {
    const currentAssignments = [
      { id: 'row-a1', productLotId: 'lot-wheat', warehouseDoorId: 'door-a1' },
      { id: 'row-b1', productLotId: 'lot-wheat', warehouseDoorId: 'door-b1' },
    ]

    const withdrawal = planLotDoorChanges({
      lotId: 'lot-wheat',
      assign: [],
      withdraw: ['door-b1', 'door-a1'],
      currentAssignments,
      doorsById: new Map(),
      plannedShiftDoorIds: ['door-a1'],
    })
    const move = planLotDoorChanges({
      lotId: 'lot-barley',
      assign: ['door-a1'],
      withdraw: [],
      currentAssignments,
      doorsById: available('door-a1'),
      plannedShiftDoorIds: ['door-a1'],
    })

    assert.deepEqual(
      withdrawal.issues.map((issue) => [issue.field, issue.rule]),
      [['withdraw.1', 'selectedByPlannedShift']],
    )
    assert.deepEqual(move.issues, [])
  })

  test('refuses shift doors the discharge does not assign and weighing areas no longer available', ({
    assert,
  }) => {
    const plan = planShiftCheckpointChanges({
      warehouseDoors: { add: ['door-a1', 'door-z9'], remove: [] },
      weighingAreas: { add: ['area-archived', 'area-north', 'area-unknown'], remove: [] },
      currentSelections: { warehouseDoors: [], weighingAreas: [] },
      assignedDoorIds: ['door-a1'],
      areasById: new Map([
        ['area-north', { id: 'area-north', status: 'AVAILABLE' }],
        ['area-archived', { id: 'area-archived', status: 'ARCHIVED' }],
      ]),
    })

    assert.deepEqual(
      plan.issues.map((issue) => [issue.field, issue.rule]),
      [
        ['warehouseDoors.add.1', 'assignedWarehouseDoor'],
        ['weighingAreas.add.0', 'availableWeighingArea'],
        ['weighingAreas.add.2', 'availableWeighingArea'],
      ],
    )
  })
})
