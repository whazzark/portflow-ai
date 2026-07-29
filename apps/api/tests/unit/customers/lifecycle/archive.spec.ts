import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ArchiveCustomerUseCase from '#customers/archive/archive_customer_use_case'
import {
  CustomerAlreadyArchivedException,
  CustomerNotFoundException,
} from '#customers/shared/customer_exceptions'
import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import ClosedDischargeUsageChecker from '#site_references/shared/closed_discharge_usage_checker'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import UsedChecker from '#site_references/shared/used_checker'

test.group('ArchiveCustomerUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives an unused customer with metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.create()
    const archivedAt = DateTime.fromISO('2026-07-22T12:00:00.000+02:00')
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const archived = await (await app.container.make(ArchiveCustomerUseCase)).handle({
      id: customer.id,
      archivedByUserId: actor.id,
      archivedAt,
      comment: '  No longer active  ',
    })

    assert.equal(archived.status, 'ARCHIVED')
    assert.equal(archived.archiveComment, 'No longer active')
    assert.equal(archived.archivedByUserId, actor.id)
    assert.equal(archived.archivedAt?.toISO(), archivedAt.toISO())
  })

  test('blocks planned or active usage and repeated archival', async ({ assert }) => {
    const customer = await CustomerFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))
    const useCase = await app.container.make(ArchiveCustomerUseCase)
    await assert.rejects(
      () =>
        useCase.handle({
          id: customer.id,
          archivedByUserId: customer.id,
          archivedAt: DateTime.now(),
        }),
      'Customer is used by a planned or active discharge',
    )

    const archived = await CustomerFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    await assert.rejects(
      () =>
        useCase.handle({
          id: archived.id,
          archivedByUserId: customer.id,
          archivedAt: DateTime.now(),
        }),
      CustomerAlreadyArchivedException,
    )
  })

  test('allows closed-only usage', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () =>
      app.container.make(ClosedDischargeUsageChecker),
    )
    const archived = await (await app.container.make(ArchiveCustomerUseCase)).handle({
      id: customer.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    assert.equal(archived.status, 'ARCHIVED')
  })

  test('rejects a missing customer', async ({ assert }) => {
    const useCase = await app.container.make(ArchiveCustomerUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-0000-0000-000000000000',
          archivedByUserId: '00000000-0000-0000-0000-000000000001',
          archivedAt: DateTime.now(),
        }),
      CustomerNotFoundException,
    )
  })
})
