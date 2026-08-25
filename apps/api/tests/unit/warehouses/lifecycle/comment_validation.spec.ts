import { test } from '@japa/runner'
import { archiveWarehouseValidator } from '#warehouses/shared/warehouse_validator'

test.group('Warehouse archive comment validation', () => {
  test('trims surrounding whitespace from an accepted comment', async ({ assert }) => {
    const payload = await archiveWarehouseValidator.validate({ comment: '  Repurposed  ' })

    assert.equal(payload.comment, 'Repurposed')
  })

  test('accepts an absent or explicitly null comment', async ({ assert }) => {
    assert.isUndefined((await archiveWarehouseValidator.validate({})).comment)
    assert.isNull((await archiveWarehouseValidator.validate({ comment: null })).comment)
  })

  test('accepts a comment at exactly the shared lifecycle limit', async ({ assert }) => {
    const payload = await archiveWarehouseValidator.validate({ comment: 'x'.repeat(1000) })

    assert.lengthOf(payload.comment as string, 1000)
  })

  test('rejects a comment beyond the shared lifecycle limit', async ({ assert }) => {
    await assert.rejects(() => archiveWarehouseValidator.validate({ comment: 'x'.repeat(1001) }))
  })
})
