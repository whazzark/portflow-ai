import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import { customerProductLotsCorrectionValidator } from '#discharges/product_lots/product_lot_validator'

async function refusal(validate: () => Promise<unknown>) {
  try {
    await validate()
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

const entry = (overrides: Record<string, unknown> = {}) => ({
  productName: 'Blé tendre',
  expectedQuantityTonnes: '1200.5',
  description: null,
  ...overrides,
})

const body = (overrides: Record<string, unknown> = {}) => ({
  customerId: randomUUID(),
  productLots: [],
  removedProductLotIds: [],
  ...overrides,
})

test.group('Customer product lots correction validator', () => {
  test('accepts an empty change, and entries with or without a lot identity', async ({
    assert,
  }) => {
    const empty = await customerProductLotsCorrectionValidator.validate(body())
    assert.deepEqual(empty.productLots, [])
    assert.deepEqual(empty.removedProductLotIds, [])

    const lotId = randomUUID()
    const removedId = randomUUID()
    const payload = await customerProductLotsCorrectionValidator.validate(
      body({
        productLots: [entry({ id: lotId }), entry({ productName: 'Colza', description: 'Hold 2' })],
        removedProductLotIds: [removedId],
      }),
    )

    assert.equal(payload.productLots[0].id, lotId)
    assert.isUndefined(payload.productLots[1].id)
    assert.deepEqual(payload.removedProductLotIds, [removedId])
  })

  test('refuses malformed identities and oversized lists', async ({ assert }) => {
    const oversized = Array.from({ length: 101 }, () => randomUUID())

    for (const [invalid, field] of [
      [body({ customerId: 'not-a-uuid' }), 'customerId'],
      [body({ productLots: [entry({ id: 'not-a-uuid' })] }), 'productLots.0.id'],
      [body({ removedProductLotIds: ['not-a-uuid'] }), 'removedProductLotIds.0'],
      [body({ productLots: oversized.map((id) => entry({ id })) }), 'productLots'],
      [body({ removedProductLotIds: oversized }), 'removedProductLotIds'],
    ] as const) {
      const issues = await refusal(() => customerProductLotsCorrectionValidator.validate(invalid))

      assert.include(
        issues?.map((issue) => issue.field),
        field,
        JSON.stringify(invalid).slice(0, 80),
      )
    }
  })

  test('refuses the lot values a single correction refuses', async ({ assert }) => {
    for (const [invalid, field] of [
      [entry({ productName: '   ' }), 'productLots.0.productName'],
      [entry({ productName: 'x'.repeat(256) }), 'productLots.0.productName'],
      [entry({ expectedQuantityTonnes: '0' }), 'productLots.0.expectedQuantityTonnes'],
      [entry({ expectedQuantityTonnes: '1.2345' }), 'productLots.0.expectedQuantityTonnes'],
      [entry({ description: 'x'.repeat(2001) }), 'productLots.0.description'],
      [{ productName: 'Blé', expectedQuantityTonnes: '1' }, 'productLots.0.description'],
    ] as const) {
      const issues = await refusal(() =>
        customerProductLotsCorrectionValidator.validate(body({ productLots: [invalid] })),
      )

      assert.include(
        issues?.map((issue) => issue.field),
        field,
      )
    }
  })
})
