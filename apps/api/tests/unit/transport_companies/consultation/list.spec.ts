import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import ListTransportCompaniesUseCase from '#transport_companies/list/list_transport_companies_use_case'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'

test.group('ListTransportCompaniesUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TransportCompanyRepository))

  test('returns all transport companies from the repository', async ({ assert }) => {
    const companies = await TransportCompanyFactory.createMany(2)
    app.container.swap(
      TransportCompanyRepository,
      () => ({ list: async () => companies }) as unknown as TransportCompanyRepository,
    )

    const result = await (await app.container.make(ListTransportCompaniesUseCase)).handle()

    assert.strictEqual(result, companies)
  })

  test('preserves an empty repository result', async ({ assert }) => {
    app.container.swap(
      TransportCompanyRepository,
      () => ({ list: async () => [] }) as unknown as TransportCompanyRepository,
    )

    const result = await (await app.container.make(ListTransportCompaniesUseCase)).handle()

    assert.isEmpty(result)
  })
})
