import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('POST /api/v1/transport-companies/reactivate', () => {
  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .json({ ids: [company.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(observer)
      .json({ ids: [company.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty selection', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects a non-UUID id', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: ['not-a-uuid'] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [company.id, company.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await company.refresh()
    assert.equal(company.status, 'ARCHIVED')
  })

  test('rejects an overlong comment and reactivates nothing, including eligible companies', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const eligible = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [eligible.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await eligible.refresh()
    assert.equal(eligible.status, 'ARCHIVED')
  })

  test('reactivates multiple eligible companies with one shared comment', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TransportCompanyFactory.apply('archived').create()
    const second = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: '  Post-review restoration  ' })

    response.assertStatus(200)
    const data = response.body().data
    assert.deepEqual(
      data.updatedCompanies.map((company: { id: string }) => company.id),
      [first.id, second.id],
    )
    assert.isEmpty(data.blockedCompanies)
    assert.isTrue(
      data.updatedCompanies.every(
        (company: { status: string; reactivationComment: string }) =>
          company.status === 'AVAILABLE' &&
          company.reactivationComment === 'Post-review restoration',
      ),
    )
  })

  test('reactivates exactly the archived companies and reports the rest with their reasons, in requested order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const alreadyAvailable = await TransportCompanyFactory.create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const eligible = await TransportCompanyFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [alreadyAvailable.id, missingId, eligible.id] })

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
        [alreadyAvailable.id, 'ALREADY_AVAILABLE'],
        [missingId, 'NOT_FOUND'],
      ],
    )
    const missingBlocker = data.blockedCompanies.find(
      (company: { id: string }) => company.id === missingId,
    )
    assert.isUndefined(missingBlocker.name)
  })

  test('reactivates nothing when every company in the selection is blocked', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const alreadyAvailable = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [alreadyAvailable.id] })

    response.assertStatus(200)
    const data = response.body().data
    assert.isEmpty(data.updatedCompanies)
    assert.equal(data.blockedCompanies.length, 1)
    assert.equal(data.blockedCompanies[0].reason, 'ALREADY_AVAILABLE')
  })

  test('never reports ALREADY_ARCHIVED or HAS_AVAILABLE_TRUCKS on this endpoint', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const alreadyAvailable = await TransportCompanyFactory.create()
    const response = await client
      .post('/api/v1/transport-companies/reactivate')
      .loginAs(admin)
      .json({ ids: [alreadyAvailable.id] })

    response.assertStatus(200)
    const reasons = response
      .body()
      .data.blockedCompanies.map((company: { reason: string }) => company.reason)
    assert.notInclude(reasons, 'ALREADY_ARCHIVED')
    assert.notInclude(reasons, 'HAS_AVAILABLE_TRUCKS')
  })
})
