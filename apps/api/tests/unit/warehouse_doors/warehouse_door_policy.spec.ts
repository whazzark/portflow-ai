import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import WarehouseDoorPolicy from '#warehouse_doors/shared/warehouse_door_policy'

test.group('Warehouse door creation policy', () => {
  test('allows only organization and operations administrators to create', async ({ assert }) => {
    const policy = new WarehouseDoorPolicy()

    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).make()
      assert.isTrue(policy.create(admin))
    }

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isFalse(policy.create(user))
    }
  })

  test('keeps consultation open to every active role while creation stays closed', async ({
    assert,
  }) => {
    const policy = new WarehouseDoorPolicy()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).make()

    assert.isTrue(policy.listAvailable(observer))
    assert.isFalse(policy.create(observer))
  })
})
