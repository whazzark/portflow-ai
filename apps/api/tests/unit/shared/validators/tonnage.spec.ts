import { test } from '@japa/runner'
import vine from '@vinejs/vine'

import { tonnageString } from '#shared/validators/tonnage_validator'

const validator = vine.create({ quantity: tonnageString() })

test.group('Tonnage string validation', () => {
  test('accepts strictly positive tonnages with at most three decimals', async ({ assert }) => {
    for (const quantity of ['1', '0.001', '1250.5', '999999999.999']) {
      const payload = await validator.validate({ quantity })

      assert.equal(payload.quantity, quantity)
    }
  })

  test('rejects zero, negative, over-precise, and malformed tonnages', async ({ assert }) => {
    const accepted: string[] = []

    for (const quantity of ['0', '0.000', '-1', '1.2345', '1e3', ' 12', '1,5', '', '1000000000']) {
      const outcome = await validator.validate({ quantity }).then(
        () => 'accepted',
        () => 'rejected',
      )
      if (outcome === 'accepted') {
        accepted.push(quantity)
      }
    }

    assert.deepEqual(accepted, [])
  })

  test('rejects a tonnage sent as a number', async ({ assert }) => {
    await assert.rejects(() => validator.validate({ quantity: 12 }))
  })
})
