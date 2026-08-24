import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { UserFactory } from '#database/factories/user_factory'
import TransportCompany from '#models/transport_company'

test.group('GET /api/v1/transport-companies/available', (group) => {
  group.each.setup(async () => {
    await TransportCompany.query().delete()
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/transport-companies/available')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('returns only available companies ordered by name', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    const first = await TransportCompanyFactory.merge({ name: 'Alpha Transport' }).create()
    const second = await TransportCompanyFactory.merge({ name: 'Beta Transport' }).create()
    await TransportCompanyFactory.apply('archived').merge({ name: 'Archived First' }).create()

    const response = await client.get('/api/v1/transport-companies/available').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((company: { id: string }) => company.id),
      [first.id, second.id],
    )
    assert.isTrue(
      response.body().data.every((company: { status: string }) => company.status === 'AVAILABLE'),
    )
  })

  test('exposes contact details on available companies, populated or null', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const withContact = await TransportCompanyFactory.merge({
      name: 'Alpha Transport',
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@alpha-transport.test',
    }).create()
    const withoutContact = await TransportCompanyFactory.apply('withoutContact')
      .merge({ name: 'Beta Transport' })
      .create()

    const response = await client.get('/api/v1/transport-companies/available').loginAs(user)

    response.assertStatus(200)
    const data = response.body().data
    const migrated = data.find((company: { id: string }) => company.id === withContact.id)
    const legacy = data.find((company: { id: string }) => company.id === withoutContact.id)
    assert.equal(migrated.contactPhone, '+33 2 40 12 34 56')
    assert.equal(migrated.contactEmail, 'dispatch@alpha-transport.test')
    assert.isNull(legacy.contactPhone)
    assert.isNull(legacy.contactEmail)
  })

  test('returns an empty collection when no company is available', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    await TransportCompanyFactory.apply('archived').create()

    const response = await client.get('/api/v1/transport-companies/available').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: [] })
  })
})
