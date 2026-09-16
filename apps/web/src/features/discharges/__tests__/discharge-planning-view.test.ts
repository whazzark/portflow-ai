import { describe, expect, test } from 'vitest'

import {
  currentDoorIds,
  describeIssues,
  heldDoorRowState,
  lockedRemovals,
  lotDoorChangeSet,
  lotDoorChangeSummary,
  lotDoorColumns,
  lotHoldingDoor,
  movedDoors,
  movesPending,
  offeredDoorRowState,
  plannedShiftsSelectingDoor,
  shiftDoorOptions,
} from '@/features/discharges/discharge-planning-view'

import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildShift,
  DISCHARGES,
} from './support/fixtures'

const ENDED_AT = '2026-09-09T05:00:00.000Z'

const doorA1 = { id: 'door-a1', name: 'Door A1', status: 'AVAILABLE' as const }
const doorA2 = { id: 'door-a2', name: 'Door A2', status: 'AVAILABLE' as const }
const doorB1 = { id: 'door-b1', name: 'Door B1', status: 'AVAILABLE' as const }
const magasinA = { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' as const }
const magasinB = { id: 'warehouse-b', name: 'Magasin B', status: 'AVAILABLE' as const }

const wheat = buildLot({
  id: 'lot-wheat',
  doorAssignments: [
    buildDoorPeriod({ id: 'wheat-a2', warehouseDoor: doorA2, warehouse: magasinA }),
    buildDoorPeriod({ id: 'wheat-b1', warehouseDoor: doorB1, warehouse: magasinB }),
    buildDoorPeriod({
      id: 'wheat-a1-ended',
      warehouseDoor: doorA1,
      warehouse: magasinA,
      effectiveTo: ENDED_AT,
    }),
  ],
})
const barley = buildLot({
  id: 'lot-barley',
  productName: 'Orge',
  customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
  doorAssignments: [
    buildDoorPeriod({ id: 'barley-a1', warehouseDoor: doorA1, warehouse: magasinA }),
  ],
})

const doorSelection = (id: string, door: typeof doorA1, effectiveTo: string | null = null) => ({
  id,
  effectiveFrom: '2026-09-08T05:00:00.000Z',
  effectiveTo,
  warehouseDoor: door,
  warehouse: magasinA,
})

const detail = buildDischargeDetail(DISCHARGES[0], {
  status: 'PLANNED',
  productLots: [wheat, barley],
  shifts: [
    buildShift({ id: 'shift-current', warehouseDoors: [doorSelection('sel-1', doorA2)] }),
    buildShift({
      id: 'shift-ended',
      warehouseDoors: [doorSelection('sel-2', doorA2, ENDED_AT)],
    }),
    buildShift({
      id: 'shift-active',
      status: 'ACTIVE',
      warehouseDoors: [doorSelection('sel-3', doorA2)],
    }),
  ],
})

describe('currentDoorIds', () => {
  test('lists the doors whose assignment to the lot is still in effect', () => {
    expect(currentDoorIds(wheat)).toEqual(['door-a2', 'door-b1'])
  })
})

describe('lotHoldingDoor', () => {
  test('finds the lot a door is currently assigned to', () => {
    expect(lotHoldingDoor(detail, 'door-a1')?.id).toBe('lot-barley')
    expect(lotHoldingDoor(detail, 'door-b1')?.id).toBe('lot-wheat')
  })

  test('finds none when the door only has ended assignments or none at all', () => {
    const onlyEnded = buildDischargeDetail(DISCHARGES[0], {
      productLots: [buildLot({ doorAssignments: [buildDoorPeriod({ effectiveTo: ENDED_AT })] })],
    })

    expect(lotHoldingDoor(onlyEnded, 'door-a1')).toBeNull()
    expect(lotHoldingDoor(detail, 'door-unknown')).toBeNull()
  })
})

// biome-ignore lint/security/noSecrets: function name, not a secret
describe('plannedShiftsSelectingDoor', () => {
  test('keeps the planned shifts whose selection of the door is still in effect', () => {
    expect(plannedShiftsSelectingDoor(detail, 'door-a2').map((shift) => shift.id)).toEqual([
      'shift-current',
    ])
    expect(plannedShiftsSelectingDoor(detail, 'door-b1')).toEqual([])
  })
})

describe('lotDoorChangeSet', () => {
  test('assigns checked doors the lot does not hold and withdraws unchecked ones it holds', () => {
    expect(lotDoorChangeSet(wheat, ['door-b1', 'door-a1', 'door-c9'])).toEqual({
      assign: ['door-a1', 'door-c9'],
      withdraw: ['door-a2'],
    })
  })

  test('changes nothing when the choices match the current doors', () => {
    expect(lotDoorChangeSet(wheat, ['door-b1', 'door-a2'])).toEqual({ assign: [], withdraw: [] })
  })
})

describe('movedDoors', () => {
  const MOVED_AT = '2026-09-15T08:00:01.000Z'
  const response = buildDischargeDetail(DISCHARGES[0], {
    productLots: [
      buildLot({
        id: 'lot-wheat',
        doorAssignments: [
          buildDoorPeriod({ id: 'wheat-a1', warehouseDoor: doorA1, effectiveFrom: MOVED_AT }),
          buildDoorPeriod({ id: 'wheat-c1', warehouseDoor: doorB1, effectiveFrom: MOVED_AT }),
        ],
      }),
      buildLot({
        id: 'lot-barley',
        productName: 'Orge',
        doorAssignments: [
          buildDoorPeriod({ id: 'barley-a1', warehouseDoor: doorA1, effectiveTo: MOVED_AT }),
          buildDoorPeriod({ id: 'barley-b1-old', warehouseDoor: doorB1, effectiveTo: ENDED_AT }),
        ],
      }),
    ],
  })

  test('names the lot a door was taken from, by the instant its assignment ended', () => {
    expect(
      movedDoors(response, 'lot-wheat', ['door-a1', 'door-b1']).map((move) => [
        move.doorId,
        move.fromLot.id,
      ]),
    ).toEqual([['door-a1', 'lot-barley']])
  })
})

describe('describeIssues', () => {
  const labels: Record<string, string> = { 'door-a1': 'Door A1', 'area-south': 'Pont Sud' }
  const labelOf = (id: string) => labels[id] ?? id

  test('names the chosen resource each refusal points at, by its position in the change set', () => {
    expect(
      describeIssues(
        [
          { field: 'assign.1', message: 'This warehouse door is no longer available' },
          { field: 'weighingAreas.add.0', message: 'This weighing area is no longer available' },
        ],
        { assign: ['door-b1', 'door-a1'], weighingAreas: { add: ['area-south'] } },
        labelOf,
      ),
    ).toEqual([
      {
        list: 'assign',
        id: 'door-a1',
        message: 'This warehouse door is no longer available',
        text: 'Door A1: This warehouse door is no longer available',
      },
      {
        list: 'weighingAreas.add',
        id: 'area-south',
        message: 'This weighing area is no longer available',
        text: 'Pont Sud: This weighing area is no longer available',
      },
    ])
  })

  test('keeps a refusal it cannot place, without a resource', () => {
    expect(
      describeIssues([{ field: 'withdraw', message: 'Refused' }], { withdraw: [] }, labelOf),
    ).toEqual([{ list: 'withdraw', id: null, message: 'Refused', text: 'Refused' }])
  })
})

describe('movesPending', () => {
  test('names the lot each newly chosen door would be taken from', () => {
    // Door A1 is barley's; the wheat lot choosing it is what moves it.
    expect(movesPending(detail, wheat, [...currentDoorIds(wheat), 'door-a1'])).toEqual([
      { doorId: 'door-a1', fromLot: barley },
    ])
  })

  test('says nothing of a door no other lot holds, or of one already held', () => {
    expect(movesPending(detail, wheat, [...currentDoorIds(wheat), 'door-free'])).toEqual([])
    expect(movesPending(detail, wheat, currentDoorIds(wheat))).toEqual([])
  })
})

describe('lockedRemovals', () => {
  test('keeps a door a planned shift still uses from being withdrawn, with those shifts', () => {
    const locked = lockedRemovals(detail, wheat, ['door-b1'])

    expect([...locked.keys()]).toEqual(['door-a2'])
    expect(locked.get('door-a2')?.map((shift) => shift.id)).toEqual(['shift-current'])
  })

  test('lets a door go when only an ended or active-discharge shift used it', () => {
    // door-b1 is used by no planned shift at all.
    expect(lockedRemovals(detail, wheat, ['door-a2']).size).toBe(0)
  })
})

describe('heldDoorRowState', () => {
  test('names the planned shifts keeping a held door, whether or not it is let go of', () => {
    const kept = heldDoorRowState(detail, 'door-a2', new Set(['door-a2']))
    const letGo = heldDoorRowState(detail, 'door-a2', new Set())

    expect(kept.removing).toBe(false)
    expect(kept.shifts.map((shift) => shift.id)).toEqual(['shift-current'])
    expect(letGo.removing).toBe(true)
    expect(letGo.shifts.map((shift) => shift.id)).toEqual(['shift-current'])
  })

  test('has no shift for a door no planned shift uses', () => {
    expect(heldDoorRowState(detail, 'door-b1', new Set(['door-b1']))).toEqual({
      removing: false,
      shifts: [],
    })
  })
})

describe('offeredDoorRowState', () => {
  test('names the other lot holding a door, and says it moves once chosen', () => {
    expect(offeredDoorRowState(detail, wheat, 'door-a1', new Set())).toEqual({
      holder: barley,
      moving: false,
    })
    expect(offeredDoorRowState(detail, wheat, 'door-a1', new Set(['door-a1']))).toEqual({
      holder: barley,
      moving: true,
    })
  })

  test('has no holder for a free door, nor for one the lot itself holds', () => {
    expect(offeredDoorRowState(detail, wheat, 'door-free', new Set(['door-free']))).toEqual({
      holder: null,
      moving: false,
    })
    expect(offeredDoorRowState(detail, wheat, 'door-b1', new Set(['door-b1'])).holder).toBeNull()
  })
})

describe('lotDoorChangeSummary', () => {
  const nameOf = (id: string) => id.toUpperCase()

  test('names the doors added, removed, and taken from another lot apart', () => {
    expect(lotDoorChangeSummary(detail, wheat, ['door-b1', 'door-a1', 'door-c9'], nameOf)).toEqual({
      adds: ['DOOR-C9'],
      removes: ['DOOR-A2'],
      moves: [{ door: 'DOOR-A1', fromLot: barley }],
    })
  })

  test('is empty when nothing changes', () => {
    expect(lotDoorChangeSummary(detail, wheat, ['door-a2', 'door-b1'], nameOf)).toEqual({
      adds: [],
      removes: [],
      moves: [],
    })
  })
})

describe('shiftDoorOptions', () => {
  test('offers the doors the lots currently hold, lot by lot, each with its lot', () => {
    expect(
      shiftDoorOptions(detail).map((option) => [option.name, option.lot.id, option.canCheck]),
    ).toEqual([
      ['Magasin A › Door A2', 'lot-wheat', true],
      ['Magasin B › Door B1', 'lot-wheat', true],
      ['Magasin A › Door A1', 'lot-barley', true],
    ])
  })

  test('lists an archived door a lot still holds, but not as one to choose', () => {
    const archived = buildDischargeDetail(DISCHARGES[0], {
      productLots: [
        buildLot({
          doorAssignments: [
            buildDoorPeriod({ warehouseDoor: { ...doorA1, status: 'ARCHIVED' } }),
            buildDoorPeriod({
              id: 'closed-warehouse',
              warehouseDoor: doorB1,
              warehouse: { ...magasinB, status: 'ARCHIVED' },
            }),
          ],
        }),
      ],
    })

    expect(shiftDoorOptions(archived).map((option) => option.canCheck)).toEqual([false, false])
  })
})

describe('lotDoorColumns', () => {
  const door = (id: string, name: string, warehouse: typeof magasinA) => ({
    id,
    name,
    warehouse: { id: warehouse.id, name: warehouse.name },
  })
  const known = [
    door('door-b1', 'Door B1', magasinB),
    door('door-a2', 'Door A2', magasinA),
    door('door-a1', 'Door A1', magasinA),
    door('door-a3', 'Door A3', magasinA),
  ]

  test('lists the chosen doors in the order they were chosen, the newest last', () => {
    expect(
      lotDoorColumns(known, ['door-a2', 'door-b1', 'door-a1']).assigned.map((row) => row.id),
    ).toEqual(['door-a2', 'door-b1', 'door-a1'])
  })

  test('puts every other door back in its warehouse, by warehouse then door name', () => {
    expect(
      lotDoorColumns(known, ['door-a2']).available.map((group) => [
        group.warehouse.name,
        group.doors.map((row) => row.id),
      ]),
    ).toEqual([
      ['Magasin A', ['door-a1', 'door-a3']],
      ['Magasin B', ['door-b1']],
    ])
  })

  test('lists a door in one column only, and drops a chosen id it does not know', () => {
    const columns = lotDoorColumns([...known, known[0]], ['door-b1', 'door-unknown'])
    const listed = [
      ...columns.assigned.map((row) => row.id),
      ...columns.available.flatMap((group) => group.doors.map((row) => row.id)),
    ]

    expect(columns.assigned.map((row) => row.id)).toEqual(['door-b1'])
    expect(listed.sort()).toEqual(['door-a1', 'door-a2', 'door-a3', 'door-b1'])
  })
})
