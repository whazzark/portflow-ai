import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'

import {
  DischargeClosedException,
  DischargeNotPlannedException,
  ShiftIdConflictException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import AddPlannedShiftUseCase from '#discharges/shifts/add_planned_shift_use_case'
import type { DischargeStatus } from '#models/discharge'
import type { ShiftStatus } from '#models/shift'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const NEW_SHIFT_ID = '33333333-3333-4333-8333-333333333333'
const FIRST_SHIFT_ID = '88888888-8888-4888-8888-888888888888'
const SECOND_SHIFT_ID = '99999999-9999-4999-8999-999999999999'
const RESPONSIBLE = '11111111-1111-4111-8111-111111111111'
const TRUCK = '55555555-5555-4555-8555-555555555555'
const DOOR = '66666666-6666-4666-8666-666666666666'
const AREA = '77777777-7777-4777-8777-777777777777'

const at = (hour: number) => DateTime.utc(2026, 9, 20, hour)

type StubOptions = {
  dischargeStatus?: DischargeStatus
  firstShiftStatus?: ShiftStatus
  existingIdentity?: boolean
  insertResult?: 'INSERTED' | 'DUPLICATE_ID'
  responsibleRole?: string
}

function stubRepositories({
  dischargeStatus = 'PLANNED',
  firstShiftStatus = 'PLANNED',
  existingIdentity = false,
  insertResult = 'INSERTED',
  responsibleRole = 'OPERATIONS_LEAD',
}: StubOptions = {}) {
  const calls: string[] = []
  const writes: Record<string, unknown> = {}
  const record =
    <T>(name: string, value: T) =>
    (...args: unknown[]) => {
      calls.push(
        name.startsWith('lock') && Array.isArray(args[0])
          ? `${name}:${(args[0] as string[]).join(',')}`
          : name,
      )
      if (name.startsWith('write') || name.startsWith('insert')) {
        writes[name] = args[0]
      }
      return Promise.resolve(value)
    }
  const available = (ids: string[]) =>
    new Map(ids.map((id) => [id, { id, status: 'AVAILABLE', warehouseStatus: 'AVAILABLE' }]))

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: record('lockDischarge', { id: DISCHARGE_ID, status: dischargeStatus }),
        findShiftIdentity: record('findShiftIdentity', existingIdentity),
        listShifts: record('listShifts', [
          {
            id: FIRST_SHIFT_ID,
            sequence: 1,
            status: firstShiftStatus,
            plannedStartAt: at(0),
            plannedEndAt: at(6),
            responsibleUserId: RESPONSIBLE,
          },
          {
            id: SECOND_SHIFT_ID,
            sequence: 2,
            status: 'PLANNED',
            plannedStartAt: at(14),
            plannedEndAt: at(22),
            responsibleUserId: RESPONSIBLE,
          },
        ]),
        lockUsers: (ids: string[]) => {
          calls.push(`lockUsers:${ids.join(',')}`)
          return Promise.resolve(
            new Map(ids.map((id) => [id, { id, role: responsibleRole, accessStatus: 'ACTIVE' }])),
          )
        },
        listTruckPool: record('listTruckPool', [{ id: 'pool', truckId: TRUCK, releasedAt: null }]),
        listCurrentShiftTruckSelections: record('listCurrentShiftTruckSelections', []),
        listCurrentShiftWarehouseDoors: record('listCurrentShiftWarehouseDoors', []),
        listCurrentShiftWeighingAreas: record('listCurrentShiftWeighingAreas', []),
        listCurrentDoorAssignments: record('listCurrentDoorAssignments', [
          { id: 'assignment', productLotId: 'lot', warehouseDoorId: DOOR },
        ]),
        lockTrucks: (ids: string[]) => {
          calls.push(`lockTrucks:${ids.join(',')}`)
          return Promise.resolve(available(ids))
        },
        lockWarehouseDoors: (ids: string[]) => {
          calls.push(`lockWarehouseDoors:${ids.join(',')}`)
          return Promise.resolve(available(ids))
        },
        lockWeighingAreas: (ids: string[]) => {
          calls.push(`lockWeighingAreas:${ids.join(',')}`)
          return Promise.resolve(available(ids))
        },
        insertPlannedShift: record('insertPlannedShift', { kind: insertResult }),
        writeShiftTruckSelection: record('writeShiftTruckSelection', { kind: 'WRITTEN' }),
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(
    DischargeRepository,
    () =>
      ({
        findDetail: () =>
          Promise.resolve({ discharge: { id: DISCHARGE_ID }, otherHoldings: new Map() }),
      }) as unknown as DischargeRepository,
  )

  return { calls, writes }
}

const addition = (overrides: Record<string, unknown> = {}) => ({
  dischargeId: DISCHARGE_ID,
  id: NEW_SHIFT_ID,
  plannedStartAt: at(6),
  plannedEndAt: at(14),
  responsibleUserId: RESPONSIBLE,
  truckIds: [TRUCK],
  warehouseDoorIds: [DOOR],
  weighingAreaIds: [AREA],
  ...overrides,
})

const noResources = { truckIds: [], warehouseDoorIds: [], weighingAreaIds: [] }

async function validationIssues(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return (error.messages as Array<{ field: string; rule: string }>).map(({ field, rule }) => ({
        field,
        rule,
      }))
    }
    throw error
  }

  return null
}

test.group('Add planned shift use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge first, then the responsible, then the trucks, doors, and areas', async ({
    assert,
  }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    const result = await useCase.handle(addition())

    assert.isTrue(result.created)
    assert.deepEqual(calls, [
      'lockDischarge',
      'findShiftIdentity',
      'listShifts',
      `lockUsers:${RESPONSIBLE}`,
      'listTruckPool',
      'listCurrentShiftTruckSelections',
      `lockTrucks:${TRUCK}`,
      'listCurrentShiftWarehouseDoors',
      `lockWarehouseDoors:${DOOR}`,
      'listCurrentDoorAssignments',
      'listCurrentShiftWeighingAreas',
      `lockWeighingAreas:${AREA}`,
      'insertPlannedShift',
      'writeShiftTruckSelection',
    ])
  })

  test('inserts the shift at its place, with its doors, areas, and then its trucks', async ({
    assert,
  }) => {
    const { writes } = stubRepositories()
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    await useCase.handle(addition())

    const insert = writes.insertPlannedShift as {
      shiftId: string
      sequence: number
      sequences: unknown
      warehouseDoors: { inserts: Array<{ resourceId: string }> }
      weighingAreas: { inserts: Array<{ resourceId: string }> }
    }
    assert.equal(insert.shiftId, NEW_SHIFT_ID)
    assert.equal(insert.sequence, 2)
    assert.deepEqual(insert.sequences, [{ shiftId: SECOND_SHIFT_ID, sequence: 3 }])
    assert.deepEqual(
      insert.warehouseDoors.inserts.map((row) => row.resourceId),
      [DOOR],
    )
    assert.deepEqual(
      insert.weighingAreas.inserts.map((row) => row.resourceId),
      [AREA],
    )
    assert.containsSubset(writes.writeShiftTruckSelection, {
      shiftId: NEW_SHIFT_ID,
      deleteIds: [],
    })
  })

  test('writes no truck selection when none is requested', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    await useCase.handle(addition(noResources))

    assert.include(calls, 'insertPlannedShift')
    assert.notInclude(calls, 'writeShiftTruckSelection')
  })

  test('answers a replay without checking or writing anything, whatever the status', async ({
    assert,
  }) => {
    for (const dischargeStatus of ['PLANNED', 'ACTIVE', 'CLOSED'] as const) {
      const { calls } = stubRepositories({ existingIdentity: true, dischargeStatus })
      const useCase = await app.container.make(AddPlannedShiftUseCase)

      const result = await useCase.handle(addition())

      assert.isFalse(result.created)
      assert.deepEqual(calls, ['lockDischarge', 'findShiftIdentity'])
      app.container.restore(DischargePreparationRepository)
    }
  })

  test('refuses a closed discharge before reading its shifts', async ({ assert }) => {
    const { calls } = stubRepositories({ dischargeStatus: 'CLOSED' })
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    await assert.rejects(() => useCase.handle(addition(noResources)), DischargeClosedException)
    assert.deepEqual(calls, ['lockDischarge', 'findShiftIdentity'])
  })

  test('refuses resources on an active discharge before locking anything else', async ({
    assert,
  }) => {
    for (const resources of [
      { truckIds: [TRUCK] },
      { warehouseDoorIds: [DOOR] },
      { weighingAreaIds: [AREA] },
    ]) {
      const { calls } = stubRepositories({ dischargeStatus: 'ACTIVE' })
      const useCase = await app.container.make(AddPlannedShiftUseCase)

      await assert.rejects(
        () => useCase.handle(addition({ ...noResources, ...resources })),
        DischargeNotPlannedException,
      )
      assert.deepEqual(calls, ['lockDischarge', 'findShiftIdentity'])
      app.container.restore(DischargePreparationRepository)
    }
  })

  test('adds a shift to an active discharge without reading any resource', async ({ assert }) => {
    const { calls } = stubRepositories({ dischargeStatus: 'ACTIVE', firstShiftStatus: 'ACTIVE' })
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    await useCase.handle(addition(noResources))

    assert.deepEqual(calls, [
      'lockDischarge',
      'findShiftIdentity',
      'listShifts',
      `lockUsers:${RESPONSIBLE}`,
      'insertPlannedShift',
    ])
  })

  test('collects every refusal at once and writes nothing', async ({ assert }) => {
    const { calls } = stubRepositories({ responsibleRole: 'OBSERVER' })
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    const issues = await validationIssues(() =>
      useCase.handle(
        addition({
          plannedStartAt: at(5),
          truckIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
          warehouseDoorIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        }),
      ),
    )

    assert.deepEqual(issues, [
      { field: 'plannedStartAt', rule: 'shiftOverlap' },
      { field: 'responsibleUserId', rule: 'eligibleShiftResponsible' },
      { field: 'truckIds.0', rule: 'heldTruck' },
      { field: 'warehouseDoorIds.0', rule: 'assignedWarehouseDoor' },
    ])
    assert.notInclude(calls, 'insertPlannedShift')
  })

  test('refuses an identity another discharge already uses', async ({ assert }) => {
    stubRepositories({ insertResult: 'DUPLICATE_ID' })
    const useCase = await app.container.make(AddPlannedShiftUseCase)

    await assert.rejects(() => useCase.handle(addition(noResources)), ShiftIdConflictException)
  })
})
