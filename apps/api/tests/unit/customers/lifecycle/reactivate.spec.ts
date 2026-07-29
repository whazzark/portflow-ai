import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ReactivateCustomerUseCase from '#customers/reactivate/reactivate_customer_use_case'
import {
  CustomerAlreadyAvailableException,
  CustomerNotFoundException,
} from '#customers/shared/customer_exceptions'
import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('ReactivateCustomerUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('reactivates the same identity with metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.apply('archived').create()
    const reactivatedAt = DateTime.fromISO('2026-07-22T13:00:00.000+02:00')
    const reactivated = await (await app.container.make(ReactivateCustomerUseCase)).handle({
      id: customer.id,
      reactivatedByUserId: actor.id,
      reactivatedAt,
      comment: '  Returning to operations  ',
    })

    assert.equal(reactivated.id, customer.id)
    assert.equal(reactivated.status, 'AVAILABLE')
    assert.equal(reactivated.reactivatedByUserId, actor.id)
    assert.equal(reactivated.reactivationComment, 'Returning to operations')
    assert.equal(reactivated.reactivatedAt?.toISO(), reactivatedAt.toISO())
  })

  test('rejects reactivation of an available customer', async ({ assert }) => {
    const available = await CustomerFactory.create()
    const useCase = await app.container.make(ReactivateCustomerUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: available.id,
          reactivatedByUserId: available.id,
          reactivatedAt: DateTime.now(),
        }),
      CustomerAlreadyAvailableException,
    )
  })

  test('rejects a missing customer', async ({ assert }) => {
    const useCase = await app.container.make(ReactivateCustomerUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-0000-0000-000000000000',
          reactivatedByUserId: '00000000-0000-0000-0000-000000000001',
          reactivatedAt: DateTime.now(),
        }),
      CustomerNotFoundException,
    )
  })
})
