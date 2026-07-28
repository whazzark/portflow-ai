import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import ListCustomersUseCase from '#customers/list/list_customers_use_case'
import CustomerRepository from '#customers/shared/repositories/customer_repository'
import { CustomerFactory } from '#database/factories/customer_factory'

test.group('ListCustomersUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(CustomerRepository))

  test('returns all customers from the repository', async ({ assert }) => {
    const customers = await CustomerFactory.createMany(2)
    app.container.swap(
      CustomerRepository,
      () => ({ list: async () => customers }) as CustomerRepository,
    )
    const result = await (await app.container.make(ListCustomersUseCase)).handle()

    assert.strictEqual(result, customers)
  })

  test('preserves an empty repository result', async ({ assert }) => {
    app.container.swap(CustomerRepository, () => ({ list: async () => [] }) as CustomerRepository)
    const result = await (await app.container.make(ListCustomersUseCase)).handle()

    assert.isEmpty(result)
  })
})
