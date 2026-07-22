import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import CreateCustomerUseCase from '#customers/create/create_customer_use_case'
import {
  ArchivedCustomerReadOnlyException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import LucidCustomerRepository from '#customers/shared/repositories/lucid_customer_repository'
import UpdateCustomerUseCase from '#customers/update/update_customer_use_case'
import { CustomerFactory } from '#database/factories/customer_factory'

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
})
