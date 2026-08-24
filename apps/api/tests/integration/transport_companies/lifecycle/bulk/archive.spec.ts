import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('POST /api/v1/transport-companies/archive', () => {
  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .json({ ids: [company.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(observer)
      .json({ ids: [company.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty selection', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects a non-UUID id', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: ['not-a-uuid'] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: [company.id, company.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await company.refresh()
    assert.equal(company.status, 'AVAILABLE')
  })

  test('rejects an overlong comment and archives nothing, including eligible companies', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const eligible = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: [eligible.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await eligible.refresh()
    assert.equal(eligible.status, 'AVAILABLE')
  })

  test('archives multiple eligible companies with one shared comment', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TransportCompanyFactory.create()
    const second = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: '  Contract review Q3  ' })

    response.assertStatus(200)
    const data = response.body().data
    assert.deepEqual(
      data.updatedCompanies.map((company: { id: string }) => company.id),
      [first.id, second.id],
    )
    assert.isEmpty(data.blockedCompanies)
    assert.isTrue(
      data.updatedCompanies.every(
        (company: { status: string; archiveComment: string }) =>
          company.status === 'ARCHIVED' && company.archiveComment === 'Contract review Q3',
      ),
    )
  })

  test('archives exactly the eligible companies and reports the rest with their reasons, in requested order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const alreadyArchived = await TransportCompanyFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const blockedByTruck = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: blockedByTruck.id }).create()
    const eligible = await TransportCompanyFactory.create()

    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: [alreadyArchived.id, missingId, blockedByTruck.id, eligible.id] })

    response.assertStatus(200)
    const data = response.body().data
    assert.deepEqual(
      data.updatedCompanies.map((company: { id: string }) => company.id),
      [eligible.id],
    )
    assert.deepEqual(
      data.blockedCompanies.map((company: { id: string; reason: string }) => [
        company.id,
        company.reason,
      ]),
      [
        [alreadyArchived.id, 'ALREADY_ARCHIVED'],
        [missingId, 'NOT_FOUND'],
        [blockedByTruck.id, 'HAS_AVAILABLE_TRUCKS'],
      ],
    )
    const missingBlocker = data.blockedCompanies.find(
      (company: { id: string }) => company.id === missingId,
    )
    assert.isUndefined(missingBlocker.name)

    await blockedByTruck.refresh()
    assert.equal(blockedByTruck.status, 'AVAILABLE')
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('archives nothing when every company in the selection is blocked', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const alreadyArchived = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/transport-companies/archive')
      .loginAs(admin)
      .json({ ids: [alreadyArchived.id] })

    response.assertStatus(200)
    const data = response.body().data
    assert.isEmpty(data.updatedCompanies)
    assert.equal(data.blockedCompanies.length, 1)
    assert.equal(data.blockedCompanies[0].reason, 'ALREADY_ARCHIVED')
  })
})
