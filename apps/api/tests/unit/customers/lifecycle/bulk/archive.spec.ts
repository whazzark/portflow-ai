import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ArchiveCustomersUseCase from '#customers/archive/archive_customers_use_case'
import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'

test.group('ArchiveCustomersUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives eligible customers and reports blockers in request order', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await CustomerFactory.create()
    const archived = await CustomerFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const result = await (await app.container.make(ArchiveCustomersUseCase)).handle({
      ids: [available.id, archived.id, '00000000-0000-0000-0000-000000000000'],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Cleanup  ',
    })

    assert.deepEqual(
      result.updatedCustomers.map((customer) => customer.id),
      [available.id],
    )
    assert.deepEqual(
      result.blockedCustomers.map((blocker) => [blocker.id, blocker.reason]),
      [
        [archived.id, 'ALREADY_ARCHIVED'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('archives several customers with a normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customers = await CustomerFactory.createMany(2)
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const result = await (await app.container.make(ArchiveCustomersUseCase)).handle({
      ids: customers.map((customer) => customer.id),
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Portfolio cleanup  ',
    })

    assert.deepEqual(
      result.updatedCustomers.map((customer) => customer.id),
      customers.map((customer) => customer.id),
    )
    assert.isEmpty(result.blockedCustomers)
    assert.isTrue(
      result.updatedCustomers.every((customer) => customer.archiveComment === 'Portfolio cleanup'),
    )
  })
})
