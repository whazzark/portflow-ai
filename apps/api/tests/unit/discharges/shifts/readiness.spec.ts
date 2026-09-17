import { test } from '@japa/runner'

import {
  plannedShiftReadinessGaps,
  type ReadinessDischarge,
  type ReadinessShift,
} from '#discharges/shared/planned_shift_readiness'

const TRUCK = 'truck-1'
const DOOR = 'door-1'

const current = { effectiveTo: null }
const ended = { effectiveTo: new Date('2026-09-01T00:00:00Z') }

/** A planned shift with one usable truck, door, and weighing area, and an eligible responsible. */
function readyShift(overrides: Partial<ReadinessShift> = {}): ReadinessShift {
  return {
    status: 'PLANNED',
    responsible: { role: 'OPERATIONS_LEAD', accessStatus: 'ACTIVE' } as const,
    truckMemberships: [{ truckId: TRUCK, truck: { status: 'AVAILABLE' }, ...current }],
    warehouseDoorMemberships: [
      {
        warehouseDoorId: DOOR,
        warehouseDoor: { status: 'AVAILABLE', warehouse: { status: 'AVAILABLE' } },
        ...current,
      },
    ],
    weighingAreaMemberships: [{ weighingArea: { status: 'AVAILABLE' }, ...current }],
    ...overrides,
  }
}

function discharge(overrides: Partial<ReadinessDischarge> = {}): ReadinessDischarge {
  return {
    truckAssignments: [{ truckId: TRUCK, releasedAt: null }],
    productLots: [{ doorAssignments: [{ warehouseDoorId: DOOR, ...current }] }],
    ...overrides,
  }
}

test.group('plannedShiftReadinessGaps', () => {
  test('states nothing for a shift that has started', ({ assert }) => {
    for (const status of ['ACTIVE', 'COMPLETED'] as const) {
      assert.isNull(plannedShiftReadinessGaps(readyShift({ status }), discharge()))
    }
  })

  test('finds nothing missing on a fully prepared shift', ({ assert }) => {
    assert.deepEqual(plannedShiftReadinessGaps(readyShift(), discharge()), [])
  })

  test('finds no usable truck when none is selected, held, or in service', ({ assert }) => {
    const cases: Array<[Partial<ReadinessShift>, Partial<ReadinessDischarge>]> = [
      [{ truckMemberships: [] }, {}],
      [{ truckMemberships: [{ truckId: TRUCK, truck: { status: 'AVAILABLE' }, ...ended }] }, {}],
      [{ truckMemberships: [{ truckId: TRUCK, truck: { status: 'SUSPENDED' }, ...current }] }, {}],
      [{ truckMemberships: [{ truckId: TRUCK, truck: { status: 'ARCHIVED' }, ...current }] }, {}],
      [{}, { truckAssignments: [{ truckId: TRUCK, releasedAt: new Date() }] }],
      [{}, { truckAssignments: [] }],
    ]

    for (const [shift, held] of cases) {
      assert.deepEqual(
        plannedShiftReadinessGaps(readyShift(shift), discharge(held)),
        ['NO_USABLE_TRUCK'],
        JSON.stringify([shift, held]),
      )
    }
  })

  test('finds no usable door when it is archived, in an archived warehouse, or held by no lot', ({
    assert,
  }) => {
    const door = (status: string, warehouseStatus: string) => ({
      warehouseDoorMemberships: [
        {
          warehouseDoorId: DOOR,
          warehouseDoor: { status, warehouse: { status: warehouseStatus } },
          ...current,
        },
      ],
    })
    const cases: Array<[Partial<ReadinessShift>, Partial<ReadinessDischarge>]> = [
      [{ warehouseDoorMemberships: [] }, {}],
      [door('ARCHIVED', 'AVAILABLE'), {}],
      [door('AVAILABLE', 'ARCHIVED'), {}],
      [{}, { productLots: [{ doorAssignments: [{ warehouseDoorId: DOOR, ...ended }] }] }],
    ]

    for (const [shift, lots] of cases) {
      assert.deepEqual(
        plannedShiftReadinessGaps(readyShift(shift), discharge(lots)),
        ['NO_USABLE_WAREHOUSE_DOOR'],
        JSON.stringify([shift, lots]),
      )
    }
  })

  test('finds no usable weighing area when it is archived or no longer selected', ({ assert }) => {
    for (const weighingAreaMemberships of [
      [],
      [{ weighingArea: { status: 'ARCHIVED' }, ...current }],
      [{ weighingArea: { status: 'AVAILABLE' }, ...ended }],
    ]) {
      assert.deepEqual(
        plannedShiftReadinessGaps(readyShift({ weighingAreaMemberships }), discharge()),
        ['NO_USABLE_WEIGHING_AREA'],
      )
    }
  })

  test('finds a responsible who is no longer eligible', ({ assert }) => {
    for (const responsible of [
      { role: 'OBSERVER', accessStatus: 'ACTIVE' },
      { role: 'OPERATIONS_LEAD', accessStatus: 'DEACTIVATED' },
      { role: 'OPERATIONS_ADMIN', accessStatus: 'PENDING' },
    ] as const) {
      assert.deepEqual(plannedShiftReadinessGaps(readyShift({ responsible }), discharge()), [
        'RESPONSIBLE_NOT_ELIGIBLE',
      ])
    }
  })

  test('needs only one usable resource of a kind, among unusable ones', ({ assert }) => {
    const shift = readyShift({
      truckMemberships: [
        { truckId: 'truck-suspended', truck: { status: 'SUSPENDED' }, ...current },
        { truckId: TRUCK, truck: { status: 'AVAILABLE' }, ...current },
      ],
    })

    assert.deepEqual(
      plannedShiftReadinessGaps(
        shift,
        discharge({
          truckAssignments: [
            { truckId: 'truck-suspended', releasedAt: null },
            { truckId: TRUCK, releasedAt: null },
          ],
        }),
      ),
      [],
    )
  })

  test('lists every gap in a fixed order', ({ assert }) => {
    const shift = readyShift({
      responsible: { role: 'OBSERVER', accessStatus: 'ACTIVE' } as const,
      truckMemberships: [],
      warehouseDoorMemberships: [],
      weighingAreaMemberships: [],
    })

    assert.deepEqual(plannedShiftReadinessGaps(shift, discharge()), [
      'NO_USABLE_TRUCK',
      'NO_USABLE_WAREHOUSE_DOOR',
      'NO_USABLE_WEIGHING_AREA',
      'RESPONSIBLE_NOT_ELIGIBLE',
    ])
  })
})
