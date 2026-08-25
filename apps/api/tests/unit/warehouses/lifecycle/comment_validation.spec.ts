import { test } from '@japa/runner'
import {
  archiveWarehouseValidator,
  reactivateWarehousesValidator,
  reactivateWarehouseValidator,
} from '#warehouses/shared/warehouse_validator'

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

test.group('Warehouse reactivate comment validation', () => {
  test('trims surrounding whitespace from an accepted comment', async ({ assert }) => {
    const payload = await reactivateWarehouseValidator.validate({ comment: '  Reopened  ' })

    assert.equal(payload.comment, 'Reopened')
  })

  test('accepts an absent or explicitly null comment', async ({ assert }) => {
    assert.isUndefined((await reactivateWarehouseValidator.validate({})).comment)
    assert.isNull((await reactivateWarehouseValidator.validate({ comment: null })).comment)
  })

  test('accepts a comment at exactly the shared lifecycle limit', async ({ assert }) => {
    const payload = await reactivateWarehouseValidator.validate({ comment: 'x'.repeat(1000) })

    assert.lengthOf(payload.comment as string, 1000)
  })

  test('rejects a comment beyond the shared lifecycle limit', async ({ assert }) => {
    await assert.rejects(() => reactivateWarehouseValidator.validate({ comment: 'x'.repeat(1001) }))
  })

  // Both directions and both scopes share one comment rule, so the bulk validator must not drift.
  test('applies the same comment rule to a selection', async ({ assert }) => {
    const id = '11111111-1111-4111-8111-111111111111'

    assert.equal(
      (await reactivateWarehousesValidator.validate({ ids: [id], comment: '  Reopened  ' }))
        .comment,
      'Reopened',
    )
    await assert.rejects(() =>
      reactivateWarehousesValidator.validate({ ids: [id], comment: 'x'.repeat(1001) }),
    )
  })

  test('rejects an empty, duplicated, or malformed selection', async ({ assert }) => {
    const id = '11111111-1111-4111-8111-111111111111'

    await assert.rejects(() => reactivateWarehousesValidator.validate({ ids: [] }))
    await assert.rejects(() => reactivateWarehousesValidator.validate({ ids: [id, id] }))
    await assert.rejects(() => reactivateWarehousesValidator.validate({ ids: ['not-a-uuid'] }))
  })
})
