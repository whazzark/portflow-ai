import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { USER_ROLES } from '#models/user'
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

  test('allows only organization and operations administrators to archive', async ({ assert }) => {
    const policy = new WarehouseDoorPolicy()

    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).make()
      assert.isTrue(policy.archive(admin))
    }

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isFalse(policy.archive(user))
    }
  })

  test('allows only organization and operations administrators to reactivate', async ({
    assert,
  }) => {
    const policy = new WarehouseDoorPolicy()

    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).make()
      assert.isTrue(policy.reactivate(admin))
    }

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isFalse(policy.reactivate(user))
    }
  })

  test('governs archival and reactivation with exactly the right that governs creation and update', async ({
    assert,
  }) => {
    const policy = new WarehouseDoorPolicy()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).make()

      // One administration right for the whole resource: an administrator who may create and
      // correct a door may retire it and bring it back, and nobody else may do any of the four.
      // Access status is not this policy's to decide — the auth middleware refuses a non-active
      // session upstream, which is why every ability here reads the role alone.
      assert.equal(policy.archive(user), policy.create(user))
      assert.equal(policy.archive(user), policy.update(user))
      assert.equal(policy.reactivate(user), policy.create(user))
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
