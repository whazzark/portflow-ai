import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('Customers administration', () => {
  test('rejects unauthenticated customer creation', async ({ assert, client }) => {
    const response = await client.post('/customers').json({
      code: 'ACME',
      companyName: 'Acme',
    })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects customer administration for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client
      .post('/customers')
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

    const createResponse = await client.post('/customers').loginAs(admin).json({
      code: '  acme-01  ',
      companyName: '  Acme   Logistics  ',
    })

    createResponse.assertStatus(201)
    assert.equal(createResponse.body().data.code, 'ACME-01')
    assert.equal(createResponse.body().data.companyName, 'Acme   Logistics')
    assert.equal(createResponse.body().data.status, 'AVAILABLE')

    const customerId = createResponse.body().data.id
    const updateResponse = await client
      .patch(`/customers/${customerId}`)
      .loginAs(admin)
      .json({ companyName: 'Acme Maritime' })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().data.id, customerId)
    assert.equal(updateResponse.body().data.code, 'ACME-01')
    assert.equal(updateResponse.body().data.companyName, 'Acme Maritime')
  })

  test('lists archived customers but excludes them from available selections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const available = await CustomerFactory.merge({ code: 'AVAILABLE-01' }).create()
    const archived = await CustomerFactory.apply('archived').merge({ code: 'ARCHIVED-01' }).create()

    const listResponse = await client.get('/customers').loginAs(admin)
    const availableResponse = await client.get('/customers/available').loginAs(admin)

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

    const duplicateResponse = await client.post('/customers').loginAs(admin).json({
      code: ' duplicate-01 ',
      companyName: 'Another Company',
    })
    const archivedResponse = await client
      .patch(`/customers/${archived.id}`)
      .loginAs(admin)
      .json({ code: 'NEW-CODE' })

    duplicateResponse.assertStatus(409)
    assert.equal(duplicateResponse.body().error.code, 'E_CUSTOMER_CODE_CONFLICT')
    assert.equal(existing.code, 'DUPLICATE-01')
    archivedResponse.assertStatus(409)
    assert.equal(archivedResponse.body().error.code, 'E_CUSTOMER_ARCHIVED')
  })
})
