import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('POST /api/v1/transport-companies/:id/reactivate', () => {
  test('rejects unauthenticated reactivation', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects reactivation for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(observer)
      .json({})

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('reactivates an archived company and returns the complete representation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archiver = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived')
      .merge({
        archivedByUserId: archiver.id,
        archiveComment: 'Provider no longer serves the site',
      })
      .create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Framework contract renewed for the season' })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.id, company.id)
    assert.equal(data.name, company.name)
    assert.equal(data.status, 'AVAILABLE')
    assert.equal(data.reactivationComment, 'Framework contract renewed for the season')
    assert.equal(data.reactivatedByUserId, admin.id)
    assert.equal(data.reactivatedBy.id, admin.id)
    assert.isNotNull(data.reactivatedAt)
    assert.equal(data.updatedAt, data.reactivatedAt)

    // The archive triple is returned unchanged.
    assert.equal(data.archivedByUserId, archiver.id)
    assert.equal(data.archivedBy.id, archiver.id)
    assert.equal(data.archiveComment, 'Provider no longer serves the site')
    assert.isNotNull(data.archivedAt)
  })

  test('reactivates with an empty body and stores no comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.isNull(response.body().data.reactivationComment)
  })

  test('accepts either administration role', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'AVAILABLE')
  })

  test('reactivates a company whose archival records no actor', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived')
      .merge({
        archivedByUserId: null,
        archiveComment: 'Historical provider retained without a resolvable actor',
      })
      .create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.status, 'AVAILABLE')
    assert.isNull(data.archivedByUserId)
    assert.isNull(data.archivedBy)
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await company.refresh()
    assert.equal(company.status, 'ARCHIVED')
  })

  test('accepts a comment at the maximum length', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1000) })

    response.assertStatus(200)
    assert.equal(response.body().data.reactivationComment, 'a'.repeat(1000))
  })

  test('refuses an unauthorized request before validating the body, even for an unknown company', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client
      .post('/api/v1/transport-companies/00000000-0000-4000-8000-000000000000/reactivate')
      .loginAs(observer)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects reactivation of an already available company and preserves its context', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await TransportCompanyFactory.apply('reactivated').create()
    const response = await client
      .post(`/api/v1/transport-companies/${available.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'A different comment' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_ALREADY_AVAILABLE')
    await available.refresh()
    assert.notEqual(available.reactivationComment, 'A different comment')
  })

  test('rejects reactivation of a company that does not exist', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies/00000000-0000-4000-8000-000000000000/reactivate')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_NOT_FOUND')
  })

  test('refuses an unauthorized request before validating its body', async ({ client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(observer)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(403)
  })

  test('is coupled with the other transport-company and truck endpoints', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const truck = await TruckFactory.apply('archived')
      .merge({ transportCompanyId: company.id })
      .create()

    const reactivateResponse = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({})
    reactivateResponse.assertStatus(200)

    const fullList = await client.get('/api/v1/transport-companies').loginAs(admin).qs({})
    const listed = fullList.body().data.find((item: { id: string }) => item.id === company.id)
    assert.equal(listed.status, 'AVAILABLE')
    assert.isNotNull(listed.reactivatedAt)
    assert.isNotNull(listed.archivedAt)

    const availableList = await client
      .get('/api/v1/transport-companies/available')
      .loginAs(admin)
      .qs({})
    assert.isDefined(
      availableList.body().data.find((item: { id: string }) => item.id === company.id),
    )

    const updateResponse = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'Renamed after reactivation' })
    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().data.name, 'Renamed after reactivation')

    const truckCreation = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'YY-888-YY',
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })
    truckCreation.assertStatus(201)

    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')

    const archiveResponse = await client
      .post(`/api/v1/transport-companies/${company.id}/archive`)
      .loginAs(admin)
      .json({})
    archiveResponse.assertStatus(409)
    assert.equal(archiveResponse.body().error.code, 'E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS')
  })

  test('an archived company keeps its name reserved and reactivates once its name is free again', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('archived').create()

    const conflictResponse = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: company.name })
    conflictResponse.assertStatus(409)
    assert.equal(conflictResponse.body().error.code, 'E_TRANSPORT_COMPANY_NAME_CONFLICT')

    const reactivateResponse = await client
      .post(`/api/v1/transport-companies/${company.id}/reactivate`)
      .loginAs(admin)
      .json({})
    reactivateResponse.assertStatus(200)
    assert.equal(reactivateResponse.body().data.status, 'AVAILABLE')
  })
})
