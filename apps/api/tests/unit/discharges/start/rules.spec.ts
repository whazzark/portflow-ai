import { test } from '@japa/runner'

import {
  type DischargeStartState,
  evaluateDischargeStart,
  type StartHolder,
} from '#discharges/start/discharge_start_rules'

const WHEAT = 'lot-wheat'
const BARLEY = 'lot-barley'
const DOOR_A = 'door-a'
const DOOR_B = 'door-b'
const TRUCK_1 = 'truck-1'
const TRUCK_2 = 'truck-2'
const SHIFT = 'shift-first'
const CEDAR: StartHolder = { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar' }
const MISTRAL: StartHolder = { dischargeId: 'discharge-mistral', vesselName: 'MV Mistral' }

/** A discharge that can start; each test changes only what it is about. */
function readyState(overrides: Partial<DischargeStartState> = {}): DischargeStartState {
  return {
    dischargeId: 'discharge-dawn',
    dock: { id: 'dock-west', status: 'AVAILABLE' },
    lots: [
      { id: WHEAT, customer: { id: 'cargill', status: 'AVAILABLE' }, currentDoorIds: [DOOR_A] },
      { id: BARLEY, customer: { id: 'soufflet', status: 'AVAILABLE' }, currentDoorIds: [DOOR_B] },
    ],
    doors: new Map([
      [DOOR_A, { status: 'AVAILABLE', warehouseStatus: 'AVAILABLE' }],
      [DOOR_B, { status: 'AVAILABLE', warehouseStatus: 'AVAILABLE' }],
    ]),
    heldTruckIds: [TRUCK_1, TRUCK_2],
    firstShift: {
      id: SHIFT,
      responsible: { id: 'lead', accessStatus: 'ACTIVE', role: 'OPERATIONS_LEAD' },
      trucks: [{ id: TRUCK_1, status: 'AVAILABLE' }],
      doorIds: [DOOR_A],
      weighingAreas: [{ id: 'area-north', status: 'AVAILABLE' }],
    },
    holders: { dock: null, trucks: new Map(), doors: new Map() },
    ...overrides,
  }
}

const codes = (state: DischargeStartState) =>
  evaluateDischargeStart(state).problems.map((problem) => problem.code)

test.group('Discharge start rules — conflicts', () => {
  test('starts the first shift of a ready discharge with no problem', ({ assert }) => {
    assert.deepEqual(evaluateDischargeStart(readyState()), { shiftId: SHIFT, problems: [] })
  })

  test('refuses a dock that serves another active discharge', ({ assert }) => {
    const state = readyState({ holders: { dock: CEDAR, trucks: new Map(), doors: new Map() } })

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'ACTIVE_DISCHARGE_CONFLICT',
        code: 'DOCK_HELD',
        subject: { type: 'DOCK', id: 'dock-west' },
        holder: CEDAR,
      },
    ])
  })

  test('refuses a pool truck held by another active discharge, even one no shift uses', ({
    assert,
  }) => {
    const state = readyState({
      holders: { dock: null, trucks: new Map([[TRUCK_2, MISTRAL]]), doors: new Map() },
    })

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'ACTIVE_DISCHARGE_CONFLICT',
        code: 'TRUCK_HELD',
        subject: { type: 'TRUCK', id: TRUCK_2 },
        holder: MISTRAL,
      },
    ])
  })

  test('refuses a current door assigned in another active discharge, naming its lot', ({
    assert,
  }) => {
    const state = readyState({
      holders: { dock: null, trucks: new Map(), doors: new Map([[DOOR_B, CEDAR]]) },
    })

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'ACTIVE_DISCHARGE_CONFLICT',
        code: 'WAREHOUSE_DOOR_HELD',
        subject: { type: 'WAREHOUSE_DOOR', id: DOOR_B },
        context: { type: 'PRODUCT_LOT', id: BARLEY },
        holder: CEDAR,
      },
    ])
  })

  test('lists every conflict at once: the dock, then trucks and doors in plan order', ({
    assert,
  }) => {
    const state = readyState({
      holders: {
        dock: CEDAR,
        trucks: new Map([
          [TRUCK_2, MISTRAL],
          [TRUCK_1, CEDAR],
        ]),
        doors: new Map([
          [DOOR_B, CEDAR],
          [DOOR_A, MISTRAL],
        ]),
      },
    })

    assert.deepEqual(codes(state), [
      'DOCK_HELD',
      'TRUCK_HELD',
      'TRUCK_HELD',
      'WAREHOUSE_DOOR_HELD',
      'WAREHOUSE_DOOR_HELD',
    ])
    assert.deepEqual(
      evaluateDischargeStart(state).problems.map((problem) => problem.subject.id),
      ['dock-west', TRUCK_1, TRUCK_2, DOOR_A, DOOR_B],
    )
  })
})

const firstShift = (state: DischargeStartState) => {
  if (!state.firstShift) {
    throw new Error('The ready state has a first shift')
  }

  return state.firstShift
}

test.group('Discharge start rules — incomplete preparation', () => {
  test('refuses a discharge without product lot, whose shift then has no usable door', ({
    assert,
  }) => {
    const state = readyState({ lots: [], doors: new Map() })

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'INCOMPLETE_PREPARATION',
        code: 'NO_PRODUCT_LOT',
        subject: { type: 'DISCHARGE', id: 'discharge-dawn' },
      },
      {
        family: 'INCOMPLETE_PREPARATION',
        code: 'SHIFT_WITHOUT_WAREHOUSE_DOOR',
        subject: { type: 'SHIFT', id: SHIFT },
      },
    ])
  })

  test('refuses a discharge without planned shift, and raises no shift problem', ({ assert }) => {
    const evaluation = evaluateDischargeStart(readyState({ firstShift: null }))

    assert.isNull(evaluation.shiftId)
    assert.deepEqual(evaluation.problems, [
      {
        family: 'INCOMPLETE_PREPARATION',
        code: 'NO_PLANNED_SHIFT',
        subject: { type: 'DISCHARGE', id: 'discharge-dawn' },
      },
    ])
  })

  test('refuses each lot without a current warehouse door', ({ assert }) => {
    const state = readyState()
    state.lots[1].currentDoorIds = []

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'INCOMPLETE_PREPARATION',
        code: 'LOT_WITHOUT_WAREHOUSE_DOOR',
        subject: { type: 'PRODUCT_LOT', id: BARLEY },
      },
    ])
  })

  test('counts a suspended truck as unusable without reporting it on its own', ({ assert }) => {
    const suspended = readyState()
    firstShift(suspended).trucks = [{ id: TRUCK_1, status: 'SUSPENDED' }]
    const alongside = readyState()
    firstShift(alongside).trucks = [
      { id: TRUCK_1, status: 'SUSPENDED' },
      { id: TRUCK_2, status: 'AVAILABLE' },
    ]

    assert.deepEqual(evaluateDischargeStart(suspended).problems, [
      {
        family: 'INCOMPLETE_PREPARATION',
        code: 'SHIFT_WITHOUT_TRUCK',
        subject: { type: 'SHIFT', id: SHIFT },
      },
    ])
    assert.deepEqual(codes(alongside), [])
  })

  test('refuses an archived only truck as both missing and unavailable', ({ assert }) => {
    const state = readyState()
    firstShift(state).trucks = [{ id: TRUCK_1, status: 'ARCHIVED' }]

    assert.deepEqual(codes(state), ['SHIFT_WITHOUT_TRUCK', 'TRUCK_ARCHIVED'])
  })

  test('refuses a truck the pool no longer holds as unusable', ({ assert }) => {
    const state = readyState({ heldTruckIds: [TRUCK_2] })

    assert.deepEqual(codes(state), ['SHIFT_WITHOUT_TRUCK'])
  })

  test('refuses a shift door no lot of the discharge currently has, or an archived one', ({
    assert,
  }) => {
    const unassigned = readyState()
    firstShift(unassigned).doorIds = ['door-elsewhere']
    const archived = readyState({
      doors: new Map([
        [DOOR_A, { status: 'AVAILABLE', warehouseStatus: 'ARCHIVED' }],
        [DOOR_B, { status: 'AVAILABLE', warehouseStatus: 'AVAILABLE' }],
      ]),
    })

    assert.deepEqual(codes(unassigned), ['SHIFT_WITHOUT_WAREHOUSE_DOOR'])
    assert.includeMembers(codes(archived), ['SHIFT_WITHOUT_WAREHOUSE_DOOR'])
  })

  test('refuses a shift whose only weighing area is archived', ({ assert }) => {
    const state = readyState()
    firstShift(state).weighingAreas = [{ id: 'area-north', status: 'ARCHIVED' }]

    assert.deepEqual(codes(state), ['SHIFT_WITHOUT_WEIGHING_AREA', 'WEIGHING_AREA_ARCHIVED'])
  })
})

test.group('Discharge start rules — unavailable references', () => {
  test('refuses an archived dock', ({ assert }) => {
    const state = readyState({ dock: { id: 'dock-west', status: 'ARCHIVED' } })

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'UNAVAILABLE_REFERENCE',
        code: 'DOCK_ARCHIVED',
        subject: { type: 'DOCK', id: 'dock-west' },
      },
    ])
  })

  test('refuses an archived customer, naming its lot', ({ assert }) => {
    const state = readyState()
    state.lots[0].customer.status = 'ARCHIVED'

    assert.deepEqual(evaluateDischargeStart(state).problems, [
      {
        family: 'UNAVAILABLE_REFERENCE',
        code: 'CUSTOMER_ARCHIVED',
        subject: { type: 'CUSTOMER', id: 'cargill' },
        context: { type: 'PRODUCT_LOT', id: WHEAT },
      },
    ])
  })

  test('refuses an archived door, or a door of an archived warehouse, once per lot and shift', ({
    assert,
  }) => {
    const state = readyState({
      doors: new Map([
        [DOOR_A, { status: 'ARCHIVED', warehouseStatus: 'AVAILABLE' }],
        [DOOR_B, { status: 'AVAILABLE', warehouseStatus: 'ARCHIVED' }],
      ]),
    })

    const archived = evaluateDischargeStart(state).problems.filter(
      (problem) => problem.code === 'WAREHOUSE_DOOR_ARCHIVED',
    )

    assert.deepEqual(archived, [
      {
        family: 'UNAVAILABLE_REFERENCE',
        code: 'WAREHOUSE_DOOR_ARCHIVED',
        subject: { type: 'WAREHOUSE_DOOR', id: DOOR_A },
        context: { type: 'PRODUCT_LOT', id: WHEAT },
      },
      {
        family: 'UNAVAILABLE_REFERENCE',
        code: 'WAREHOUSE_DOOR_ARCHIVED',
        subject: { type: 'WAREHOUSE_DOOR', id: DOOR_B },
        context: { type: 'PRODUCT_LOT', id: BARLEY },
      },
      {
        family: 'UNAVAILABLE_REFERENCE',
        code: 'WAREHOUSE_DOOR_ARCHIVED',
        subject: { type: 'WAREHOUSE_DOOR', id: DOOR_A },
        context: { type: 'SHIFT', id: SHIFT },
      },
    ])
  })

  test('refuses an archived weighing area and truck of the first shift, naming the shift', ({
    assert,
  }) => {
    const state = readyState()
    firstShift(state).trucks.push({ id: TRUCK_2, status: 'ARCHIVED' })
    firstShift(state).weighingAreas.push({ id: 'area-south', status: 'ARCHIVED' })

    assert.deepEqual(
      evaluateDischargeStart(state).problems.map(({ code, subject, context }) => ({
        code,
        subject,
        context,
      })),
      [
        {
          code: 'WEIGHING_AREA_ARCHIVED',
          subject: { type: 'WEIGHING_AREA', id: 'area-south' },
          context: { type: 'SHIFT', id: SHIFT },
        },
        {
          code: 'TRUCK_ARCHIVED',
          subject: { type: 'TRUCK', id: TRUCK_2 },
          context: { type: 'SHIFT', id: SHIFT },
        },
      ],
    )
  })
})

test.group('Discharge start rules — responsible and ordering', () => {
  test('refuses a responsible who is no longer an active lead or admin', ({ assert }) => {
    for (const responsible of [
      { accessStatus: 'ACTIVE', role: 'OBSERVER' },
      { accessStatus: 'DEACTIVATED', role: 'OPERATIONS_LEAD' },
      { accessStatus: 'PENDING', role: 'ORGANIZATION_ADMIN' },
      { accessStatus: 'CANCELLED', role: 'OPERATIONS_ADMIN' },
    ] as const) {
      const state = readyState()
      firstShift(state).responsible = { id: 'lead', ...responsible }

      assert.deepEqual(evaluateDischargeStart(state).problems, [
        {
          family: 'INELIGIBLE_RESPONSIBLE',
          code: 'RESPONSIBLE_INELIGIBLE',
          subject: { type: 'USER', id: 'lead' },
          context: { type: 'SHIFT', id: SHIFT },
        },
      ])
    }
  })

  test('lists every problem found, family by family', ({ assert }) => {
    const state = readyState({
      dock: { id: 'dock-west', status: 'ARCHIVED' },
      holders: { dock: CEDAR, trucks: new Map(), doors: new Map() },
    })
    state.lots[1].currentDoorIds = []
    firstShift(state).responsible = { id: 'lead', accessStatus: 'DEACTIVATED', role: 'OBSERVER' }
    firstShift(state).weighingAreas = []

    assert.deepEqual(codes(state), [
      'LOT_WITHOUT_WAREHOUSE_DOOR',
      'SHIFT_WITHOUT_WEIGHING_AREA',
      'DOCK_ARCHIVED',
      'RESPONSIBLE_INELIGIBLE',
      'DOCK_HELD',
    ])
  })
})
