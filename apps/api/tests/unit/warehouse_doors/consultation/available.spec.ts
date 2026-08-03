import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import ListAvailableWarehouseDoorsUseCase from '#warehouse_doors/available/list_available_warehouse_doors_use_case'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'

test.group('ListAvailableWarehouseDoorsUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(WarehouseDoorRepository))

  test('returns available doors from the repository', async ({ assert }) => {
    const warehouse = await WarehouseFactory.create()
    const doors = await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).createMany(2)
    app.container.swap(
      WarehouseDoorRepository,
      () => ({ listAvailable: async () => doors }) as unknown as WarehouseDoorRepository,
    )

    const result = await (await app.container.make(ListAvailableWarehouseDoorsUseCase)).handle()

    assert.strictEqual(result, doors)
  })

  test('preserves an empty repository result', async ({ assert }) => {
    app.container.swap(
      WarehouseDoorRepository,
      () => ({ listAvailable: async () => [] }) as unknown as WarehouseDoorRepository,
    )

    const result = await (await app.container.make(ListAvailableWarehouseDoorsUseCase)).handle()

    assert.isEmpty(result)
  })

  test('propagates repository failures to the authoritative request boundary', async ({
    assert,
  }) => {
    const failure = new Error('warehouse door snapshot unavailable')
    app.container.swap(
      WarehouseDoorRepository,
      () =>
        ({
          listAvailable: () => Promise.reject(failure),
        }) as unknown as WarehouseDoorRepository,
    )

    await assert.rejects(
      async () => (await app.container.make(ListAvailableWarehouseDoorsUseCase)).handle(),
      /warehouse door snapshot unavailable/,
    )
  })
})
