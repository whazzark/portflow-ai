import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'

import {
  ShiftNotFoundException,
  ShiftNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import CorrectPlannedShiftUseCase from '#discharges/shifts/correct_planned_shift_use_case'
import type { ShiftStatus } from '#models/shift'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const SHIFT_ID = '88888888-8888-4888-8888-888888888888'
const NEXT_SHIFT_ID = '99999999-9999-4999-8999-999999999999'
const RESPONSIBLE = '11111111-1111-4111-8111-111111111111'
const KEPT = '55555555-5555-4555-8555-555555555555'
const ADDED = '66666666-6666-4666-8666-666666666666'
const UNKNOWN = '77777777-7777-4777-8777-777777777777'

const at = (hour: number) => DateTime.utc(2026, 9, 20, hour)

function stubRepositories({ shiftStatus = 'PLANNED' }: { shiftStatus?: ShiftStatus | null } = {}) {
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
      if (name.startsWith('write')) {
        writes[name] = args[0]
      }
      return Promise.resolve(value)
    }
  const locked = (status: string) => (ids: string[]) =>
    new Map(
      ids.map((id) => [
        id,
        { id, status: id === UNKNOWN ? 'ARCHIVED' : status, warehouseStatus: 'AVAILABLE' },
      ]),
    )

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: record('lockDischarge', { id: DISCHARGE_ID, status: 'PLANNED' }),
        findShift: record('findShift', shiftStatus ? { id: SHIFT_ID, status: shiftStatus } : null),
        listShifts: record('listShifts', [
          {
            id: SHIFT_ID,
            sequence: 1,
            status: 'PLANNED',
            plannedStartAt: at(6),
            plannedEndAt: at(14),
            responsibleUserId: RESPONSIBLE,
          },
          {
            id: NEXT_SHIFT_ID,
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
            new Map(ids.map((id) => [id, { id, role: 'OPERATIONS_LEAD', accessStatus: 'ACTIVE' }])),
          )
        },
        listTruckPool: record('listTruckPool', [
          { id: 'pool-kept', truckId: KEPT, releasedAt: null },
          { id: 'pool-added', truckId: ADDED, releasedAt: null },
        ]),
        listCurrentShiftTruckSelections: record('listCurrentShiftTruckSelections', [
          { id: 'truck-kept', shiftId: SHIFT_ID, truckId: KEPT },
        ]),
        listCurrentShiftWarehouseDoors: record('listCurrentShiftWarehouseDoors', [
          { id: 'door-kept', resourceId: KEPT },
        ]),
        listCurrentShiftWeighingAreas: record('listCurrentShiftWeighingAreas', [
          { id: 'area-kept', resourceId: KEPT },
        ]),
        lockTrucks: (ids: string[]) => {
          calls.push(`lockTrucks:${ids.join(',')}`)
          return Promise.resolve(locked('AVAILABLE')(ids))
        },
        lockWarehouseDoors: (ids: string[]) => {
          calls.push(`lockWarehouseDoors:${ids.join(',')}`)
          return Promise.resolve(locked('AVAILABLE')(ids))
        },
        lockWeighingAreas: (ids: string[]) => {
          calls.push(`lockWeighingAreas:${ids.join(',')}`)
          return Promise.resolve(locked('AVAILABLE')(ids))
        },
        writeShiftTruckSelection: record('writeShiftTruckSelection', { kind: 'WRITTEN' }),
        writePlannedShiftCorrection: record('writePlannedShiftCorrection', undefined),
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

const correction = (overrides: Record<string, unknown> = {}) => ({
  dischargeId: DISCHARGE_ID,
  shiftId: SHIFT_ID,
  plannedStartAt: at(22),
  plannedEndAt: at(23),
  responsibleUserId: RESPONSIBLE,
  truckIds: [KEPT, ADDED],
  warehouseDoorIds: [KEPT, ADDED],
  weighingAreaIds: [ADDED],
  ...overrides,
})

test.group('Correct planned shift use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge first, then the responsible, then only the added trucks, doors, and areas', async ({
    assert,
  }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CorrectPlannedShiftUseCase)

    await useCase.handle(correction())

    assert.deepEqual(calls, [
      'lockDischarge',
      'findShift',
      'listShifts',
      `lockUsers:${RESPONSIBLE}`,
      'listTruckPool',
      'listCurrentShiftTruckSelections',
      `lockTrucks:${ADDED}`,
      'listCurrentShiftWarehouseDoors',
      `lockWarehouseDoors:${ADDED}`,
      'listCurrentShiftWeighingAreas',
      `lockWeighingAreas:${ADDED}`,
      'writeShiftTruckSelection',
      'writePlannedShiftCorrection',
    ])
  })

  test('writes the new period, the renumbered shifts, and each selection change', async ({
    assert,
  }) => {
    const { writes } = stubRepositories()
    const useCase = await app.container.make(CorrectPlannedShiftUseCase)

    await useCase.handle(correction())

    assert.containsSubset(writes.writeShiftTruckSelection, { shiftId: SHIFT_ID, deleteIds: [] })
    const write = writes.writePlannedShiftCorrection as {
      plannedStartAt: DateTime
      sequences: unknown
      warehouseDoors: { deleteIds: string[]; inserts: Array<{ resourceId: string }> }
      weighingAreas: { deleteIds: string[]; inserts: Array<{ resourceId: string }> }
    }
    assert.equal(write.plannedStartAt.toMillis(), at(22).toMillis())
    assert.deepEqual(write.sequences, [
      { shiftId: NEXT_SHIFT_ID, sequence: 1 },
      { shiftId: SHIFT_ID, sequence: 2 },
    ])
    assert.deepEqual(write.warehouseDoors.deleteIds, [])
    assert.deepEqual(
      write.warehouseDoors.inserts.map((row) => row.resourceId),
      [ADDED],
    )
    assert.deepEqual(write.weighingAreas.deleteIds, ['area-kept'])
  })

  test('writes nothing when the correction changes nothing', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CorrectPlannedShiftUseCase)

    await useCase.handle(
      correction({
        plannedStartAt: at(6),
        plannedEndAt: at(14),
        truckIds: [KEPT],
        warehouseDoorIds: [KEPT],
        weighingAreaIds: [KEPT],
      }),
    )

    assert.isFalse(calls.some((call) => call.startsWith('write')))
  })

  test('refuses an unknown or no longer planned shift before locking anything else', async ({
    assert,
  }) => {
    for (const [shiftStatus, exception] of [
      [null, ShiftNotFoundException],
      ['ACTIVE', ShiftNotPlannedException],
    ] as const) {
      const { calls } = stubRepositories({ shiftStatus })
      const useCase = await app.container.make(CorrectPlannedShiftUseCase)

      await assert.rejects(() => useCase.handle(correction()), exception)
      assert.deepEqual(calls, ['lockDischarge', 'findShift'])
    }
  })

  test('collects every refusal at once, without writing', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CorrectPlannedShiftUseCase)

    try {
      await useCase.handle(
        correction({
          plannedStartAt: at(10),
          plannedEndAt: at(9),
          truckIds: [UNKNOWN],
          warehouseDoorIds: [UNKNOWN],
          weighingAreaIds: [KEPT, UNKNOWN],
        }),
      )
      assert.fail('The correction should have been refused')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      assert.deepEqual(
        (error as { messages: Array<{ field: string; rule: string }> }).messages.map((issue) => [
          issue.field,
          issue.rule,
        ]),
        [
          ['plannedEndAt', 'shiftPeriodOrder'],
          ['truckIds.0', 'heldTruck'],
          ['warehouseDoorIds.0', 'availableWarehouseDoor'],
          ['weighingAreaIds.1', 'availableWeighingArea'],
        ],
      )
    }
    assert.isFalse(calls.some((call) => call.startsWith('write')))
  })
})
