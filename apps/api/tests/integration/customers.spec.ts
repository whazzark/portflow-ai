import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('Customers administration', () => {
  test('rejects unauthenticated customer creation', async ({ assert, client }) => {
    const response = await client.post('/api/v1/customers').json({
      code: 'ACME',
      companyName: 'Acme',
    })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects unauthenticated lifecycle transitions', async ({ assert, client }) => {
    const customer = await CustomerFactory.merge({ code: 'UNAUTH-LIFECYCLE' }).create()
    const archiveResponse = await client.post(`/api/v1/customers/${customer.id}/archive`).json({})
    const reactivateResponse = await client.post(`/api/v1/customers/${customer.id}/reactivate`)

    archiveResponse.assertStatus(401)
    reactivateResponse.assertStatus(401)
    assert.equal(archiveResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal(reactivateResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects customer administration for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client
      .post('/api/v1/customers')
      .loginAs(observer)
      .json({ code: 'ACME', companyName: 'Acme' })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('creates and updates a normalized customer while preserving its identity', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const createResponse = await client.post('/api/v1/customers').loginAs(admin).json({
      code: '  acme-01  ',
      companyName: '  Acme   Logistics  ',
    })

    createResponse.assertStatus(201)
    assert.equal(createResponse.body().data.code, 'ACME-01')
    assert.equal(createResponse.body().data.companyName, 'Acme   Logistics')
    assert.equal(createResponse.body().data.status, 'AVAILABLE')
    assert.deepEqual(Object.keys(createResponse.body().data).sort(), [
      'code',
      'companyName',
      'createdAt',
      'id',
      'status',
      'updatedAt',
    ])

    const customerId = createResponse.body().data.id
    const updateResponse = await client
      .patch(`/api/v1/customers/${customerId}`)
      .loginAs(admin)
      .json({ companyName: 'Acme Maritime' })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().data.id, customerId)
    assert.equal(updateResponse.body().data.code, 'ACME-01')
    assert.equal(updateResponse.body().data.companyName, 'Acme Maritime')
  })

  test('allows active operational users to resolve available and archived customers', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const available = await CustomerFactory.merge({ code: 'VISIBLE-01' }).create()
    const archived = await CustomerFactory.apply('archived').merge({ code: 'HISTORIC-01' }).create()

    const availableResponse = await client
      .get(`/api/v1/customers/${available.id}`)
      .loginAs(observer)
    const archivedResponse = await client.get(`/api/v1/customers/${archived.id}`).loginAs(observer)

    availableResponse.assertStatus(200)
    archivedResponse.assertStatus(200)
    assert.equal(availableResponse.body().data.id, available.id)
    assert.equal(archivedResponse.body().data.id, archived.id)
    assert.equal(archivedResponse.body().data.status, 'ARCHIVED')
  })

  test('rejects invalid customer payloads with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.merge({ code: 'VALIDATION-01' }).create()

    const missingCodeResponse = await client.post('/api/v1/customers').loginAs(admin).json({
      companyName: 'Acme Logistics',
    })
    const emptyCodeResponse = await client.post('/api/v1/customers').loginAs(admin).json({
      code: '   ',
      companyName: 'Another Logistics',
    })
    const oversizedCodeResponse = await client
      .post('/api/v1/customers')
      .loginAs(admin)
      .json({
        code: 'A'.repeat(256),
        companyName: 'Oversized Logistics',
      })
    const emptyUpdateResponse = await client
      .patch(`/api/v1/customers/${customer.id}`)
      .loginAs(admin)
      .json({})

    for (const response of [missingCodeResponse, emptyCodeResponse, oversizedCodeResponse]) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.isString(response.body().error.message)
      assert.isArray(response.body().error.details)
    }
    assert.equal(missingCodeResponse.body().error.details[0].field, 'code')
    emptyUpdateResponse.assertStatus(422)
    assert.deepEqual(emptyUpdateResponse.body().error, {
      code: 'E_CUSTOMER_UPDATE_FIELDS_REQUIRED',
      message: 'At least one customer field must be provided',
    })
  })

  test('lists archived customers but excludes them from available selections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const available = await CustomerFactory.merge({ code: 'AVAILABLE-01' }).create()
    const archived = await CustomerFactory.apply('archived').merge({ code: 'ARCHIVED-01' }).create()

    const listResponse = await client.get('/api/v1/customers').loginAs(admin)
    const availableResponse = await client.get('/api/v1/customers/available').loginAs(admin)

    listResponse.assertStatus(200)
    availableResponse.assertStatus(200)
    assert.includeMembers(
      listResponse.body().data.map((customer: { id: string }) => customer.id),
      [available.id, archived.id],
    )
    assert.includeMembers(
      availableResponse.body().data.map((customer: { id: string }) => customer.id),
      [available.id],
    )
    assert.notInclude(
      availableResponse.body().data.map((customer: { id: string }) => customer.id),
      archived.id,
    )
  })

  test('rejects duplicate code and archived customer updates', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const existing = await CustomerFactory.merge({ code: 'DUPLICATE-01' }).create()
    const archived = await CustomerFactory.apply('archived').create()

    const duplicateResponse = await client.post('/api/v1/customers').loginAs(admin).json({
      code: ' duplicate-01 ',
      companyName: 'Another Company',
    })
    const archivedResponse = await client
      .patch(`/api/v1/customers/${archived.id}`)
      .loginAs(admin)
      .json({ code: 'NEW-CODE' })

    duplicateResponse.assertStatus(409)
    assert.equal(duplicateResponse.body().error.code, 'E_CUSTOMER_CODE_CONFLICT')
    assert.equal(existing.code, 'DUPLICATE-01')
    archivedResponse.assertStatus(409)
    assert.equal(archivedResponse.body().error.code, 'E_CUSTOMER_ARCHIVED')
  })

  test('archives a customer, preserves historical visibility, and removes it from selections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.merge({ code: 'ARCHIVE-01' }).create()

    const archiveResponse = await client
      .post(`/api/v1/customers/${customer.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Retired account' })
    const availableResponse = await client.get('/api/v1/customers/available').loginAs(admin)
    const detailResponse = await client.get(`/api/v1/customers/${customer.id}`).loginAs(admin)

    archiveResponse.assertStatus(200)
    assert.equal(archiveResponse.body().data.status, 'ARCHIVED')
    assert.equal(archiveResponse.body().data.archiveComment, 'Retired account')
    assert.equal(archiveResponse.body().data.archivedByUserId, admin.id)
    assert.notInclude(
      availableResponse.body().data.map((item: { id: string }) => item.id),
      customer.id,
    )
    detailResponse.assertStatus(200)
    assert.equal(detailResponse.body().data.id, customer.id)
    assert.equal(detailResponse.body().data.status, 'ARCHIVED')
  })

  test('reactivates the same customer identity and makes it selectable again', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const customer = await CustomerFactory.apply('archived')
      .merge({ code: 'REACTIVATE-01' })
      .create()

    const response = await client
      .post(`/api/v1/customers/${customer.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Returning to operations' })
    const availableResponse = await client.get('/api/v1/customers/available').loginAs(admin)

    response.assertStatus(200)
    assert.equal(response.body().data.id, customer.id)
    assert.equal(response.body().data.status, 'AVAILABLE')
    assert.equal(response.body().data.reactivatedByUserId, admin.id)
    assert.equal(response.body().data.reactivationComment, 'Returning to operations')
    assert.include(
      availableResponse.body().data.map((item: { id: string }) => item.id),
      customer.id,
    )
  })

  test('rejects archive and reactivate actions for non-admin users', async ({ client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const available = await CustomerFactory.merge({ code: 'FORBIDDEN-01' }).create()
    const archived = await CustomerFactory.apply('archived')
      .merge({ code: 'FORBIDDEN-02' })
      .create()

    const archiveResponse = await client
      .post(`/api/v1/customers/${available.id}/archive`)
      .loginAs(observer)
    const reactivateResponse = await client
      .post(`/api/v1/customers/${archived.id}/reactivate`)
      .loginAs(observer)

    archiveResponse.assertStatus(403)
    reactivateResponse.assertStatus(403)
  })

  test('maps repeated lifecycle transitions to conflicts', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await CustomerFactory.merge({ code: 'CONFLICT-AVAILABLE' }).create()
    const archived = await CustomerFactory.apply('archived')
      .merge({ code: 'CONFLICT-ARCHIVED' })
      .create()

    const archiveResponse = await client
      .post(`/api/v1/customers/${archived.id}/archive`)
      .loginAs(admin)
      .json({})
    const reactivateResponse = await client
      .post(`/api/v1/customers/${available.id}/reactivate`)
      .loginAs(admin)

    archiveResponse.assertStatus(409)
    reactivateResponse.assertStatus(409)
    assert.equal(archiveResponse.body().error.code, 'E_CUSTOMER_ALREADY_ARCHIVED')
    assert.equal(reactivateResponse.body().error.code, 'E_CUSTOMER_ALREADY_AVAILABLE')
  })
})
