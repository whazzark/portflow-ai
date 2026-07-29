import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('POST /api/v1/customers', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated creation', async ({ assert, client }) => {
    const response = await client
      .post('/api/v1/customers')
      .json({ code: 'ACME', companyName: 'Acme' })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects creation for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client
      .post('/api/v1/customers')
      .loginAs(observer)
      .json({ code: 'ACME', companyName: 'Acme' })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('creates a normalized customer', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client.post('/api/v1/customers').loginAs(admin).json({
      code: '  acme-01  ',
      companyName: '  Acme   Logistics  ',
    })

    response.assertStatus(201)
    assert.equal(response.body().data.code, 'ACME-01')
    assert.equal(response.body().data.companyName, 'Acme   Logistics')
    assert.equal(response.body().data.status, 'AVAILABLE')
  })

  test('rejects invalid and duplicate customer identities', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    await CustomerFactory.merge({ code: 'DUPLICATE-01' }).create()

    const missingCode = await client
      .post('/api/v1/customers')
      .loginAs(admin)
      .json({ companyName: 'Acme' })
    const blankCode = await client
      .post('/api/v1/customers')
      .loginAs(admin)
      .json({ code: '   ', companyName: 'Acme' })
    const duplicate = await client
      .post('/api/v1/customers')
      .loginAs(admin)
      .json({ code: ' duplicate-01 ', companyName: 'Another' })

    missingCode.assertStatus(422)
    blankCode.assertStatus(422)
    duplicate.assertStatus(409)
    assert.equal(missingCode.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(duplicate.body().error.code, 'E_CUSTOMER_CODE_CONFLICT')
  })
})
