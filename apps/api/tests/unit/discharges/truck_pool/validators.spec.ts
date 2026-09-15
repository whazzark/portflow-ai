import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import {
  shiftTruckSelectionValidator,
  truckIdsValidator,
} from '#discharges/truck_pool/truck_pool_validators'

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

test.group('Truck pool request validators', () => {
  test('a reservation or withdrawal takes 1 to 500 distinct truck identities', async ({
    assert,
  }) => {
    const upper = randomUUID().toUpperCase()

    for (const truckIds of [[randomUUID()], [upper], uuids(500)]) {
      const payload = await truckIdsValidator.validate({ truckIds })

      assert.lengthOf(payload.truckIds, truckIds.length)
    }
  })

  test('refuses a missing, empty, oversized, malformed, or repeated list of trucks', async ({
    assert,
  }) => {
    const repeated = randomUUID()

    for (const body of [
      {},
      { truckIds: [] },
      { truckIds: uuids(501) },
      { truckIds: ['not-a-uuid'] },
      { truckIds: 'x' },
    ]) {
      assert.isNotNull(await refusal(() => truckIdsValidator.validate(body)), JSON.stringify(body))
    }

    const duplicates = await refusal(() =>
      truckIdsValidator.validate({ truckIds: [repeated, repeated] }),
    )
    assert.deepInclude(
      duplicates?.map(({ field, rule }) => ({ field, rule })),
      { field: 'truckIds', rule: 'distinct' },
    )
  })

  test('treats two casings of one identity as the same truck', async ({ assert }) => {
    const id = randomUUID()

    assert.isNotNull(
      await refusal(() => truckIdsValidator.validate({ truckIds: [id, id.toUpperCase()] })),
    )
  })

  test('a shift selection may be empty but not oversized, repeated, or missing', async ({
    assert,
  }) => {
    const repeated = randomUUID()

    assert.deepEqual((await shiftTruckSelectionValidator.validate({ truckIds: [] })).truckIds, [])
    assert.lengthOf(
      (await shiftTruckSelectionValidator.validate({ truckIds: uuids(500) })).truckIds,
      500,
    )

    for (const body of [{}, { truckIds: uuids(501) }, { truckIds: [repeated, repeated] }]) {
      assert.isNotNull(await refusal(() => shiftTruckSelectionValidator.validate(body)))
    }
  })
})
