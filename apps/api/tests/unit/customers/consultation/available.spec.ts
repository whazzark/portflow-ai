import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import ListAvailableCustomersUseCase from '#customers/available/list_available_customers_use_case'
import CustomerRepository from '#customers/shared/repositories/customer_repository'
import { CustomerFactory } from '#database/factories/customer_factory'

test.group('ListAvailableCustomersUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(CustomerRepository))

  test('returns available customers from the repository', async ({ assert }) => {
    const customers = await CustomerFactory.createMany(2)
    app.container.swap(
      CustomerRepository,
      () =>
        ({
          listAvailable: async () => customers,
        }) as CustomerRepository,
    )
    const result = await (await app.container.make(ListAvailableCustomersUseCase)).handle()

    assert.strictEqual(result, customers)
  })

  test('preserves an empty available result', async ({ assert }) => {
    app.container.swap(
      CustomerRepository,
      () =>
        ({
          listAvailable: async () => [],
        }) as CustomerRepository,
    )
    const result = await (await app.container.make(ListAvailableCustomersUseCase)).handle()

    assert.isEmpty(result)
  })
})
