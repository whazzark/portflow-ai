import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ReactivateCustomersUseCase from '#customers/reactivate/reactivate_customers_use_case'
import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('ReactivateCustomersUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('reactivates eligible customers and reports blockers in request order', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const archived = await CustomerFactory.apply('archived').create()
    const available = await CustomerFactory.create()
    const result = await (await app.container.make(ReactivateCustomersUseCase)).handle({
      ids: [archived.id, available.id, '00000000-0000-0000-0000-000000000000'],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.deepEqual(
      result.updatedCustomers.map((customer) => customer.id),
      [archived.id],
    )
    assert.deepEqual(
      result.blockedCustomers.map((blocker) => [blocker.id, blocker.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('reactivates several customers with a normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customers = await CustomerFactory.apply('archived').createMany(2)
    const result = await (await app.container.make(ReactivateCustomersUseCase)).handle({
      ids: customers.map((customer) => customer.id),
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Back in service  ',
    })

    assert.deepEqual(
      result.updatedCustomers.map((customer) => customer.id),
      customers.map((customer) => customer.id),
    )
    assert.isEmpty(result.blockedCustomers)
    assert.isTrue(
      result.updatedCustomers.every(
        (customer) => customer.reactivationComment === 'Back in service',
      ),
    )
  })
})
