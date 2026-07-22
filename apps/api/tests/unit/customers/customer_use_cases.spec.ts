import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ArchiveCustomerUseCase from '#customers/archive/archive_customer_use_case'
import CreateCustomerUseCase from '#customers/create/create_customer_use_case'
import ReactivateCustomerUseCase from '#customers/reactivate/reactivate_customer_use_case'
import {
  ArchivedCustomerReadOnlyException,
  CustomerAlreadyArchivedException,
  CustomerAlreadyAvailableException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import LucidCustomerRepository from '#customers/shared/repositories/lucid_customer_repository'
import UpdateCustomerUseCase from '#customers/update/update_customer_use_case'
import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from '#site_references/shared/site_reference_usage_checker'

test.group('Customer use cases', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('normalizes the code and company name during creation', async ({ assert }) => {
    const useCase = new CreateCustomerUseCase(new LucidCustomerRepository())

    const customer = await useCase.handle({ code: '  acme-01 ', companyName: '  Acme  ' })

    assert.equal(customer.code, 'ACME-01')
    assert.equal(customer.companyName, 'Acme')
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('rejects a duplicate company name regardless of case', async ({ assert }) => {
    await CustomerFactory.merge({ companyName: 'Acme Logistics' }).create()
    const useCase = new CreateCustomerUseCase(new LucidCustomerRepository())

    await assert.rejects(
      () => useCase.handle({ code: 'NEW-CODE', companyName: ' acme logistics ' }),
      DuplicateCustomerCompanyNameException,
    )
  })

  test('keeps archived customers read-only', async ({ assert }) => {
    const archived = await CustomerFactory.apply('archived').create()
    const useCase = new UpdateCustomerUseCase(new LucidCustomerRepository())

    await assert.rejects(
      () => useCase.handle({ id: archived.id, code: 'NEW-CODE' }),
      ArchivedCustomerReadOnlyException,
    )
  })

  test('archives an unused customer with lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.create()
    const archivedAt = DateTime.fromISO('2026-07-22T12:00:00.000+02:00')
    const useCase = new ArchiveCustomerUseCase(new LucidCustomerRepository(), new UnusedChecker())

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
    const useCase = new ArchiveCustomerUseCase(new LucidCustomerRepository(), new UsedChecker())

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
    const useCase = new ArchiveCustomerUseCase(
      new LucidCustomerRepository(),
      new ClosedDischargeUsageChecker(),
    )

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
    const useCase = new ReactivateCustomerUseCase(new LucidCustomerRepository())

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
    const archive = new ArchiveCustomerUseCase(new LucidCustomerRepository(), new UnusedChecker())
    const reactivate = new ReactivateCustomerUseCase(new LucidCustomerRepository())

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
})

class UnusedChecker extends SiteReferenceUsageChecker {
  isUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput) {
    return Promise.resolve(false)
  }
}

class UsedChecker extends SiteReferenceUsageChecker {
  isUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput) {
    return Promise.resolve(true)
  }
}

class ClosedDischargeUsageChecker extends SiteReferenceUsageChecker {
  isUsedByPlannedOrActiveDischarge(_input: SiteReferenceUsageInput) {
    return Promise.resolve(false)
  }
}
