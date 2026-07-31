import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import ListAvailableTransportCompaniesUseCase from '#transport_companies/available/list_available_transport_companies_use_case'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'

test.group('ListAvailableTransportCompaniesUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TransportCompanyRepository))

  test('returns available transport companies from the repository', async ({ assert }) => {
    const companies = await TransportCompanyFactory.createMany(2)
    app.container.swap(
      TransportCompanyRepository,
      () => ({ listAvailable: async () => companies }) as unknown as TransportCompanyRepository,
    )

    const result = await (await app.container.make(ListAvailableTransportCompaniesUseCase)).handle()

    assert.strictEqual(result, companies)
  })

  test('preserves an empty repository result', async ({ assert }) => {
    app.container.swap(
      TransportCompanyRepository,
      () => ({ listAvailable: async () => [] }) as unknown as TransportCompanyRepository,
    )

    const result = await (await app.container.make(ListAvailableTransportCompaniesUseCase)).handle()

    assert.isEmpty(result)
  })
})
