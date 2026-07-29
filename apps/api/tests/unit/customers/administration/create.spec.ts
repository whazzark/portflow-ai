import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import CreateCustomerUseCase from '#customers/create/create_customer_use_case'
import {
  DuplicateCustomerCodeException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'
import { CustomerFactory } from '#database/factories/customer_factory'
import {
  InvalidSiteReferenceCodeException,
  InvalidSiteReferenceNameException,
} from '#site_references/shared/site_reference_exceptions'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('CreateCustomerUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => {
    app.container.restore(CustomerRepository)
    app.container.restore(SiteReferenceUsageChecker)
  })

  test('normalizes the customer identity', async ({ assert }) => {
    const customer = await (await app.container.make(CreateCustomerUseCase)).handle({
      code: '  acme-01 ',
      companyName: '  Acme  ',
    })

    assert.equal(customer.code, 'ACME-01')
    assert.equal(customer.companyName, 'Acme')
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('rejects duplicate and blank identities', async ({ assert }) => {
    await CustomerFactory.merge({ companyName: 'Acme Logistics' }).create()
    const useCase = await app.container.make(CreateCustomerUseCase)

    await assert.rejects(
      () => useCase.handle({ code: 'NEW', companyName: ' acme logistics ' }),
      DuplicateCustomerCompanyNameException,
    )
    app.container.swap(
      CustomerRepository,
      () =>
        ({
          create: async () => ({ kind: 'DUPLICATE_CODE' as const }),
        }) as unknown as CustomerRepository,
    )
    await assert.rejects(
      () =>
        app.container
          .make(CreateCustomerUseCase)
          .then((swappedUseCase) =>
            swappedUseCase.handle({ code: 'NEW', companyName: 'Another company' }),
          ),
      DuplicateCustomerCodeException,
    )
    await assert.rejects(
      () => useCase.handle({ code: '   ', companyName: 'Acme' }),
      InvalidSiteReferenceCodeException,
    )
    await assert.rejects(
      () => useCase.handle({ code: 'ACME', companyName: '   ' }),
      InvalidSiteReferenceNameException,
    )
  })
})
