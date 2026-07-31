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

  test('returns only available companies ordered by name then UUID', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    const laterId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const earlierId = '00000000-0000-4000-8000-000000000001'
    await TransportCompanyFactory.merge({ id: laterId, name: 'Same Name' }).create()
    await TransportCompanyFactory.merge({ id: earlierId, name: 'Same Name' }).create()
    await TransportCompanyFactory.apply('archived').merge({ name: 'Archived First' }).create()

    const response = await client.get('/api/v1/transport-companies/available').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((company: { id: string }) => company.id),
      [earlierId, laterId],
    )
    assert.isTrue(
      response.body().data.every((company: { status: string }) => company.status === 'AVAILABLE'),
    )
  })

  test('returns an empty collection when no company is available', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    await TransportCompanyFactory.apply('archived').create()

    const response = await client.get('/api/v1/transport-companies/available').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: [] })
  })
})
