import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import { plannedShiftCorrectionValidator } from '#discharges/shifts/planned_shift_validator'

function uuids(count: number) {
  return Array.from({ length: count }, () => randomUUID())
}

async function refusal(validate: () => Promise<unknown>) {
  try {
    await validate()
  } catch (error) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return error.messages as Array<{ field: string; rule: string }>
    }
    throw error
  }

  return null
}

const body = (overrides: Record<string, unknown> = {}) => ({
  plannedStartAt: '2026-09-20T06:00:00+02:00',
  plannedEndAt: '2026-09-20T14:00:00Z',
  responsibleUserId: randomUUID(),
  truckIds: [],
  warehouseDoorIds: [],
  weighingAreaIds: [],
  ...overrides,
})

test.group('Planned shift correction validator', () => {
  test('takes a period, a responsible, and three complete selections that may be empty', async ({
    assert,
  }) => {
    const door = randomUUID().toUpperCase()
    const payload = await plannedShiftCorrectionValidator.validate(
      body({ truckIds: uuids(500), warehouseDoorIds: [door], weighingAreaIds: uuids(100) }),
    )

    assert.lengthOf(payload.truckIds, 500)
    assert.deepEqual(payload.warehouseDoorIds, [door.toLowerCase()])
    assert.lengthOf(payload.weighingAreaIds, 100)
  })

  test('refuses a missing field, an instant without offset, and an oversized or repeated list', async ({
    assert,
  }) => {
    const repeated = randomUUID()

    for (const field of [
      'plannedStartAt',
      'plannedEndAt',
      'responsibleUserId',
      'truckIds',
      'warehouseDoorIds',
      'weighingAreaIds',
    ]) {
      assert.isNotNull(
        await refusal(() => plannedShiftCorrectionValidator.validate(body({ [field]: undefined }))),
        field,
      )
    }

    for (const overrides of [
      { plannedStartAt: '2026-09-20T06:00:00' },
      { responsibleUserId: 'not-a-uuid' },
      { truckIds: uuids(501) },
      { warehouseDoorIds: uuids(101) },
      { weighingAreaIds: uuids(101) },
      { warehouseDoorIds: ['not-a-uuid'] },
    ]) {
      assert.isNotNull(
        await refusal(() => plannedShiftCorrectionValidator.validate(body(overrides))),
        JSON.stringify(overrides),
      )
    }

    for (const field of ['warehouseDoorIds', 'weighingAreaIds']) {
      const duplicates = await refusal(() =>
        plannedShiftCorrectionValidator.validate(
          body({ [field]: [repeated, repeated.toUpperCase()] }),
        ),
      )
      assert.deepInclude(
        duplicates?.map((issue) => ({ field: issue.field, rule: issue.rule })),
        { field, rule: 'distinct' },
      )
    }
  })
})
