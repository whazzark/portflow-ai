import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import {
  ArchivedCustomerReadOnlyException,
  CustomerNotFoundException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'
import UpdateCustomerUseCase from '#customers/update/update_customer_use_case'
import { CustomerFactory } from '#database/factories/customer_factory'
import {
  InvalidSiteReferenceCodeException,
  InvalidSiteReferenceNameException,
} from '#site_references/shared/site_reference_exceptions'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('UpdateCustomerUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(CustomerRepository)
    app.container.restore(SiteReferenceUsageChecker)
  })

  test('updates an available customer while preserving its identity', async ({ assert }) => {
    const customer = await CustomerFactory.create()
    const repository = {
      updateAvailable: async () => ({ kind: 'UPDATED' as const, customer }),
    } as CustomerRepository
    app.container.swap(CustomerRepository, () => repository)
    const updated = await (await app.container.make(UpdateCustomerUseCase)).handle({
      id: customer.id,
      companyName: 'Updated company',
    })

    assert.strictEqual(updated, customer)
  })

  test('rejects blank fields and archived updates', async ({ assert }) => {
    const customer = await CustomerFactory.create()
    const archived = await CustomerFactory.apply('archived').create()
    const useCase = await app.container.make(UpdateCustomerUseCase)

    await assert.rejects(
      () => useCase.handle({ id: customer.id, code: '   ' }),
      InvalidSiteReferenceCodeException,
    )
    await assert.rejects(
      () => useCase.handle({ id: customer.id, companyName: '   ' }),
      InvalidSiteReferenceNameException,
    )
    await assert.rejects(
      () => useCase.handle({ id: archived.id, code: 'NEW-CODE' }),
      ArchivedCustomerReadOnlyException,
    )
  })

  test('maps missing and duplicate repository outcomes', async ({ assert }) => {
    const customer = await CustomerFactory.create()
    app.container.swap(
      CustomerRepository,
      () =>
        ({
          updateAvailable: async () => ({ kind: 'NOT_FOUND' as const }),
        }) as CustomerRepository,
    )
    await assert.rejects(
      () =>
        app.container
          .make(UpdateCustomerUseCase)
          .then((useCase) => useCase.handle({ id: customer.id, code: 'NEW' })),
      CustomerNotFoundException,
    )
    app.container.swap(
      CustomerRepository,
      () =>
        ({
          updateAvailable: async () => ({ kind: 'DUPLICATE_COMPANY_NAME' as const }),
        }) as CustomerRepository,
    )
    await assert.rejects(
      () =>
        app.container
          .make(UpdateCustomerUseCase)
          .then((useCase) => useCase.handle({ id: customer.id, companyName: 'Duplicate' })),
      DuplicateCustomerCompanyNameException,
    )
  })
})
