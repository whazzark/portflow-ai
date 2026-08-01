import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import ListWarehousesUseCase from '#warehouses/list/list_warehouses_use_case'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'

test.group('Warehouse consultation policy', () => {
  test('allows every active role to consult warehouses', async ({ assert }) => {
    const policy = new WarehousePolicy()
    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isTrue(policy.list(user))
    }
  })

  test('rejects inactive users', async ({ assert }) => {
    const policy = new WarehousePolicy()
    const user = await UserFactory.merge({ accessStatus: 'DEACTIVATED' }).make()
    assert.isFalse(policy.list(user))
  })

  test('propagates repository failures to the consultation boundary', async ({ assert }) => {
    app.container.swap(
      WarehouseRepository,
      () =>
        ({
          list: () => Promise.reject(new Error('warehouse storage unavailable')),
        }) as unknown as WarehouseRepository,
    )

    try {
      await assert.rejects(
        () => (async () => (await app.container.make(ListWarehousesUseCase)).handle())(),
        /warehouse storage unavailable/,
      )
    } finally {
      app.container.restore(WarehouseRepository)
    }
  })
})
