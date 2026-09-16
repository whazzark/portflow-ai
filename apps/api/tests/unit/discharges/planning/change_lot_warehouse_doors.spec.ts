import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
  DischargePlanningConflictException,
  ProductLotNotFoundException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import ChangeLotWarehouseDoorsUseCase from '#discharges/warehouse_doors/change_lot_warehouse_doors_use_case'
import type Discharge from '#models/discharge'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const WHEAT_ID = '55555555-5555-4555-8555-555555555555'
const BARLEY_ID = '66666666-6666-4666-8666-666666666666'
const DOOR_A1 = 'a1a1a1a1-0000-4000-8000-000000000001'
const DOOR_B1 = 'b1b1b1b1-0000-4000-8000-000000000001'
const DOOR_C1 = 'c1c1c1c1-0000-4000-8000-000000000001'

type StubDoor = {
  id: string
  status?: 'AVAILABLE' | 'ARCHIVED'
  warehouseStatus?: 'AVAILABLE' | 'ARCHIVED'
}

type StubOptions = {
  status?: Discharge['status'] | null
  currentAssignments?: Array<{ id: string; productLotId: string; warehouseDoorId: string }>
  doors?: StubDoor[]
  plannedShiftDoorIds?: string[]
  startOutcome?: 'WRITTEN' | 'CURRENT_ROW_CONFLICT'
  latest?: DateTime | null
}

function stubRepositories({
  status = 'PLANNED',
  currentAssignments = [{ id: 'row-b1', productLotId: BARLEY_ID, warehouseDoorId: DOOR_B1 }],
  doors,
  plannedShiftDoorIds = [],
  startOutcome = 'WRITTEN',
  latest = null,
}: StubOptions = {}) {
  const calls: string[] = []
  const writes: Array<{ call: string; ids: string[]; instant: string }> = []

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve(status ? { id: DISCHARGE_ID, status } : null)
        },
        listProductLots: () => {
          calls.push('listProductLots')
          return Promise.resolve([
            { id: WHEAT_ID, customerId: 'c1', productName: 'Blé' },
            { id: BARLEY_ID, customerId: 'c2', productName: 'Orge' },
          ])
        },
        listCurrentDoorAssignments: () => {
          calls.push('listCurrentDoorAssignments')
          return Promise.resolve(currentAssignments)
        },
        listShifts: () => Promise.resolve([{ id: 'shift-1', status: 'PLANNED' }]),
        listCurrentShiftSelections: () =>
          Promise.resolve({
            warehouseDoors: plannedShiftDoorIds.map((doorId, index) => ({
              id: `selection-${index}`,
              shiftId: 'shift-1',
              warehouseDoorId: doorId,
            })),
            weighingAreas: [],
          }),
        latestDoorAssignmentTime: () => Promise.resolve(latest),
        lockWarehouseDoors: (ids: string[]) => {
          calls.push(`lockWarehouseDoors:${ids.join(',')}`)
          return Promise.resolve(
            new Map(
              (doors ?? ids.map((id): StubDoor => ({ id }))).map((door) => [
                door.id,
                {
                  id: door.id,
                  status: door.status ?? 'AVAILABLE',
                  warehouseStatus: door.warehouseStatus ?? 'AVAILABLE',
                },
              ]),
            ),
          )
        },
        endRows: (table: string, ids: string[], instant: DateTime) => {
          calls.push(`endRows:${table}`)
          writes.push({ call: 'end', ids, instant: instant.toISO() ?? '' })
          return Promise.resolve()
        },
        startDoorAssignments: (rows: Array<{ warehouseDoorId: string }>, instant: DateTime) => {
          calls.push('startDoorAssignments')
          writes.push({
            call: 'start',
            ids: rows.map((row) => row.warehouseDoorId),
            instant: instant.toISO() ?? '',
          })
          return Promise.resolve({ kind: startOutcome })
        },
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(
    DischargeRepository,
    () =>
      ({
        findDetail: () =>
          Promise.resolve({
            discharge: { id: DISCHARGE_ID } as Discharge,
            otherHoldings: new Map(),
          }),
      }) as unknown as DischargeRepository,
  )

  return { calls, writes }
}

async function issuesOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return (error.messages as { field: string; rule: string }[]).map((issue) => [
        issue.field,
        issue.rule,
      ])
    }

    throw error
  }

  throw new Error('expected the change to be rejected')
}

const input = (assign: string[], withdraw: string[] = [], productLotId = WHEAT_ID) => ({
  dischargeId: DISCHARGE_ID,
  productLotId,
  assign,
  withdraw,
})

test.group('Change lot warehouse doors use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge, then only the doors being assigned, and ends before it starts', async ({
    assert,
  }) => {
    const { calls, writes } = stubRepositories()
    const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

    const detail = await useCase.handle(input([DOOR_B1, DOOR_C1], [DOOR_A1]))

    assert.equal(detail.discharge.id, DISCHARGE_ID)
    assert.isBelow(
      calls.indexOf('lockDischarge'),
      calls.indexOf(`lockWarehouseDoors:${DOOR_B1},${DOOR_C1}`),
    )
    assert.isBelow(calls.indexOf('endRows:DOOR_ASSIGNMENT'), calls.indexOf('startDoorAssignments'))
    assert.deepEqual(
      writes.map((write) => [write.call, write.ids]),
      [
        ['end', ['row-b1']],
        ['start', [DOOR_B1, DOOR_C1]],
      ],
    )
    assert.equal(writes[0].instant, writes[1].instant)
  })

  test('keeps the recorded instant past what the discharge already recorded', async ({
    assert,
  }) => {
    const latest = DateTime.utc().plus({ minutes: 5 }).startOf('second')
    const { writes } = stubRepositories({ latest })
    const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

    await useCase.handle(input([DOOR_C1]))

    assert.equal(writes[0].instant, latest.plus({ seconds: 1 }).toISO())
  })

  test('writes nothing for an empty or already applied change set', async ({ assert }) => {
    const { calls } = stubRepositories({
      currentAssignments: [{ id: 'row-c1', productLotId: WHEAT_ID, warehouseDoorId: DOOR_C1 }],
    })
    const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

    await useCase.handle(input([]))
    await useCase.handle(input([DOOR_C1.toUpperCase()], [DOOR_B1]))

    assert.notInclude(calls, 'endRows:DOOR_ASSIGNMENT')
    assert.notInclude(calls, 'startDoorAssignments')
  })

  test('refuses an unknown or no longer planned discharge, and an unknown lot', async ({
    assert,
  }) => {
    for (const [status, lotId, exception] of [
      [null, WHEAT_ID, DischargeNotFoundException],
      ['ACTIVE', WHEAT_ID, DischargeNotPlannedException],
      ['PLANNED', '99999999-9999-4999-8999-999999999999', ProductLotNotFoundException],
    ] as const) {
      const { calls } = stubRepositories({ status })
      const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

      await assert.rejects(() => useCase.handle(input([DOOR_C1], [], lotId)), exception)
      assert.notInclude(calls, 'startDoorAssignments')
    }
  })

  test('reports refused doors before writing anything', async ({ assert }) => {
    const { calls } = stubRepositories({
      currentAssignments: [{ id: 'row-a1', productLotId: WHEAT_ID, warehouseDoorId: DOOR_A1 }],
      doors: [{ id: DOOR_C1, status: 'ARCHIVED' }],
      plannedShiftDoorIds: [DOOR_A1],
    })
    const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

    assert.deepEqual(await issuesOf(useCase.handle(input([DOOR_C1], [DOOR_A1]))), [
      ['assign.0', 'availableWarehouseDoor'],
      ['withdraw.0', 'selectedByPlannedShift'],
    ])
    assert.isFalse(calls.some((call) => call.startsWith('endRows') || call.startsWith('start')))
  })

  test('turns a current-row index violation into a planning conflict', async ({ assert }) => {
    stubRepositories({ startOutcome: 'CURRENT_ROW_CONFLICT' })
    const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

    await assert.rejects(() => useCase.handle(input([DOOR_C1])), DischargePlanningConflictException)
  })

  test('refuses an identity listed to be both assigned and withdrawn', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(ChangeLotWarehouseDoorsUseCase)

    assert.deepEqual(await issuesOf(useCase.handle(input([DOOR_C1], [DOOR_C1.toUpperCase()]))), [
      // biome-ignore lint/security/noSecrets: rule name, not a secret
      ['withdraw.0', 'notInBothLists'],
    ])
    assert.deepEqual(calls, [])
  })
})
