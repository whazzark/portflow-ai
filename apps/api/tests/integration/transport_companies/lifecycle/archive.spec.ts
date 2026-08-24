import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'

// An update now carries the contact details alongside the name, so the payload below stays valid
// and the refusal under test is the archived read-only rule, not a validation error.
const VALID_CONTACT = {
  contactPhone: '+33 1 23 45 67 89',
  contactEmail: 'contact@example.test',
}

test.group('POST /api/v1/transport-companies/:id/archive', () => {
  test('rejects unauthenticated archival', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const response = await client.post(`/api/v1/transport-companies/${company.id}/archive`).json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects archival for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(observer)
      .json({})

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('archives a company with no truck and returns the complete representation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Provider no longer serves the site' })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.id, company.id)
    assert.equal(data.name, company.name)
    assert.equal(data.status, 'ARCHIVED')
    assert.equal(data.archiveComment, 'Provider no longer serves the site')
    assert.equal(data.archivedByUserId, admin.id)
    assert.equal(data.archivedBy.id, admin.id)
    assert.isNotNull(data.archivedAt)
    assert.equal(data.updatedAt, data.archivedAt)
  })

  test('archives with an empty body and stores no comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.isNull(response.body().data.archiveComment)
  })

  test('accepts either administration role', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await company.refresh()
    assert.equal(company.status, 'AVAILABLE')
  })

  test('accepts a comment at the maximum length', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1000) })

    response.assertStatus(200)
    assert.equal(response.body().data.archiveComment, 'a'.repeat(1000))
  })

  test('refuses an unauthorized request before validating the body, even for an unknown company', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client
      .post('/api/v1/transport-companies/00000000-0000-4000-8000-000000000000/archive')
      .loginAs(observer)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects archival when the company still provides an available truck', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS')
    await company.refresh()
    assert.equal(company.status, 'AVAILABLE')
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('archives a company whose trucks are all archived', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    await TruckFactory.apply('archived').merge({ transportCompanyId: company.id }).create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test('rejects archival of an already archived company and preserves its context', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archived = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${archived.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'A different comment' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_ALREADY_ARCHIVED')
    await archived.refresh()
    assert.isNull(archived.archiveComment)
  })

  test('rejects archival of a company that does not exist', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies/00000000-0000-4000-8000-000000000000/archive')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_NOT_FOUND')
  })

  test('refuses an unauthorized request before validating its body', async ({ client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const archived = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${archived.id}/archive`)
      .loginAs(observer)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(403)
  })

  test('is coupled with the other transport-company and truck endpoints', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.apply('archived')
      .merge({ transportCompanyId: company.id })
      .create()

    const archiveResponse = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({})
    archiveResponse.assertStatus(200)

    const fullList = await client.get('/api/v1/transport-companies').loginAs(admin).qs({})
    const listed = fullList.body().data.find((item: { id: string }) => item.id === company.id)
    assert.equal(listed.status, 'ARCHIVED')
    assert.isNotNull(listed.archivedAt)

    const availableList = await client
      .get('/api/v1/transport-companies/available')
      .loginAs(admin)
      .qs({})
    assert.isUndefined(
      availableList.body().data.find((item: { id: string }) => item.id === company.id),
    )

    const updateResponse = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'Attempted rename', ...VALID_CONTACT })
    updateResponse.assertStatus(409)
    assert.equal(updateResponse.body().error.code, 'E_TRANSPORT_COMPANY_ARCHIVED')

    const truckCreation = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'ZZ-999-ZZ',
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })
    truckCreation.assertStatus(422)
    assert.equal(truckCreation.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_INVALID')

    await truck.refresh()
    assert.equal(truck.transportCompanyId, company.id)
  })
})
