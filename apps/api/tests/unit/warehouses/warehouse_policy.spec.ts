import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'

test.group('Warehouse archival policy', () => {
  test('allows only organization and operations administrators to archive', async ({ assert }) => {
    const policy = new WarehousePolicy()

    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).make()
      assert.isTrue(policy.archive(admin))
    }

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isFalse(policy.archive(user))
    }
  })

  test('keeps consultation open to every active role', async ({ assert }) => {
    const policy = new WarehousePolicy()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).make()

    assert.isTrue(policy.list(observer))
    assert.isFalse(policy.archive(observer))
  })
})
