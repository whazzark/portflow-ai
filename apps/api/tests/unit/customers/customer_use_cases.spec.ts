import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ArchiveCustomerUseCase from '#customers/archive/archive_customer_use_case'
import ArchiveCustomersUseCase from '#customers/archive/archive_customers_use_case'
import CreateCustomerUseCase from '#customers/create/create_customer_use_case'
import ReactivateCustomerUseCase from '#customers/reactivate/reactivate_customer_use_case'
import ReactivateCustomersUseCase from '#customers/reactivate/reactivate_customers_use_case'
import {
  ArchivedCustomerReadOnlyException,
  BulkCustomerArchiveBlockedException,
  BulkCustomerReactivationBlockedException,
  CustomerAlreadyArchivedException,
  CustomerAlreadyAvailableException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import UpdateCustomerUseCase from '#customers/update/update_customer_use_case'
import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import ClosedDischargeUsageChecker from '#site_references/shared/closed_discharge_usage_checker'
import {
  InvalidSiteReferenceCodeException,
  InvalidSiteReferenceNameException,
} from '#site_references/shared/site_reference_exceptions'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import UsedChecker from '#site_references/shared/used_checker'

test.group('Customer use cases', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('normalizes the code and company name during creation', async ({ assert }) => {
    const useCase = await app.container.make(CreateCustomerUseCase)

    const customer = await useCase.handle({ code: '  acme-01 ', companyName: '  Acme  ' })

    assert.equal(customer.code, 'ACME-01')
    assert.equal(customer.companyName, 'Acme')
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('rejects a duplicate company name regardless of case', async ({ assert }) => {
    await CustomerFactory.merge({ companyName: 'Acme Logistics' }).create()
    const useCase = await app.container.make(CreateCustomerUseCase)

    await assert.rejects(
      () => useCase.handle({ code: 'NEW-CODE', companyName: ' acme logistics ' }),
      DuplicateCustomerCompanyNameException,
    )
  })

  test('rejects blank customer identities at the use-case seam', async ({ assert }) => {
    const useCase = await app.container.make(CreateCustomerUseCase)

    await assert.rejects(
      () => useCase.handle({ code: '   ', companyName: 'Acme' }),
      InvalidSiteReferenceCodeException,
    )
    await assert.rejects(
      () => useCase.handle({ code: 'ACME-01', companyName: '   ' }),
      InvalidSiteReferenceNameException,
    )

    const customer = await CustomerFactory.create()
    const updateUseCase = await app.container.make(UpdateCustomerUseCase)

    await assert.rejects(
      () => updateUseCase.handle({ id: customer.id, code: '   ' }),
      InvalidSiteReferenceCodeException,
    )
    await assert.rejects(
      () => updateUseCase.handle({ id: customer.id, companyName: '   ' }),
      InvalidSiteReferenceNameException,
    )
  })

  test('keeps archived customers read-only', async ({ assert }) => {
    const archived = await CustomerFactory.apply('archived').create()
    const useCase = await app.container.make(UpdateCustomerUseCase)

    await assert.rejects(
      () => useCase.handle({ id: archived.id, code: 'NEW-CODE' }),
      ArchivedCustomerReadOnlyException,
    )
  })

  test('archives an unused customer with lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.create()
    const archivedAt = DateTime.fromISO('2026-07-22T12:00:00.000+02:00')

    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const useCase = await app.container.make(ArchiveCustomerUseCase)

    const archived = await useCase.handle({
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

  test('rejects archival when a planned or active discharge uses the customer', async ({
    assert,
  }) => {
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
    await customer.refresh()
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('allows archival when the customer is used only by a closed discharge', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.create()

    app.container.swap(SiteReferenceUsageChecker, () =>
      app.container.make(ClosedDischargeUsageChecker),
    )

    const useCase = await app.container.make(ArchiveCustomerUseCase)

    const archived = await useCase.handle({
      id: customer.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    assert.equal(archived.status, 'ARCHIVED')
  })

  test('reactivates the same customer identity and records the actor', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.apply('archived').create()
    const reactivatedAt = DateTime.fromISO('2026-07-22T13:00:00.000+02:00')
    const useCase = await app.container.make(ReactivateCustomerUseCase)

    const reactivated = await useCase.handle({
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

  test('rejects repeating an archive or reactivation transition', async ({ assert }) => {
    const available = await CustomerFactory.create()
    const archived = await CustomerFactory.apply('archived').create()

    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const archive = await app.container.make(ArchiveCustomerUseCase)
    const reactivate = await app.container.make(ReactivateCustomerUseCase)

    await assert.rejects(
      () =>
        archive.handle({
          id: archived.id,
          archivedByUserId: available.id,
          archivedAt: DateTime.now(),
        }),
      CustomerAlreadyArchivedException,
    )
    await assert.rejects(
      () =>
        reactivate.handle({
          id: available.id,
          reactivatedByUserId: archived.id,
          reactivatedAt: DateTime.now(),
        }),
      CustomerAlreadyAvailableException,
    )
  })

  test('archives several unused customers atomically with a normalized comment', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const customers = await CustomerFactory.createMany(2)
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const useCase = await app.container.make(ArchiveCustomersUseCase)
    const archived = await useCase.handle({
      ids: customers.map((customer) => customer.id),
      archivedByUserId: actor.id,
      archivedAt: DateTime.fromISO('2026-07-22T14:00:00.000+02:00'),
      comment: '  Portfolio cleanup  ',
    })

    assert.deepEqual(
      archived.map((customer) => customer.id),
      customers.map((customer) => customer.id),
    )
    assert.isTrue(archived.every((customer) => customer.status === 'ARCHIVED'))
    assert.isTrue(archived.every((customer) => customer.archiveComment === 'Portfolio cleanup'))
  })

  test('reports archive blockers without mutating any customer', async ({ assert }) => {
    const available = await CustomerFactory.create()
    const archived = await CustomerFactory.apply('archived').create()
    const useCase = await app.container.make(ArchiveCustomersUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          ids: [available.id, archived.id, 'missing-customer'],
          archivedByUserId: available.id,
          archivedAt: DateTime.now(),
        }),
      BulkCustomerArchiveBlockedException,
    )
    await available.refresh()
    assert.equal(available.status, 'AVAILABLE')
  })

  test('reactivates several archived customers with a normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customers = await CustomerFactory.apply('archived').createMany(2)
    const useCase = await app.container.make(ReactivateCustomersUseCase)

    const reactivated = await useCase.handle({
      ids: customers.map((customer) => customer.id),
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.fromISO('2026-07-22T15:00:00.000+02:00'),
      comment: '  Returning to operations  ',
    })

    assert.deepEqual(
      reactivated.map((customer) => customer.id),
      customers.map((customer) => customer.id),
    )
    assert.isTrue(reactivated.every((customer) => customer.status === 'AVAILABLE'))
    assert.isTrue(
      reactivated.every((customer) => customer.reactivationComment === 'Returning to operations'),
    )
  })

  test('reports reactivation blockers without mutating any customer', async ({ assert }) => {
    const archived = await CustomerFactory.apply('archived').create()
    const available = await CustomerFactory.create()
    const useCase = await app.container.make(ReactivateCustomersUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          ids: [archived.id, available.id, 'missing-customer'],
          reactivatedByUserId: available.id,
          reactivatedAt: DateTime.now(),
        }),
      BulkCustomerReactivationBlockedException,
    )
    await archived.refresh()
    assert.equal(archived.status, 'ARCHIVED')
  })
})
