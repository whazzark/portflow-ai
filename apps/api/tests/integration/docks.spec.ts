import { test } from '@japa/runner'

import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('Docks administration', () => {
  test('rejects unauthenticated and unauthorized dock creation', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const payload = { name: 'North', latitude: 1, longitude: 2 }
    const unauthenticatedResponse = await client.post('/api/v1/docks').json(payload)
    const unauthorizedResponse = await client.post('/api/v1/docks').loginAs(observer).json(payload)

    unauthenticatedResponse.assertStatus(401)
    assert.equal(unauthenticatedResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorizedResponse.assertStatus(403)
    assert.equal(unauthorizedResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('creates and exposes a normalized dock', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client.post('/api/v1/docks').loginAs(admin).json({
      name: '  North Dock  ',
      latitude: 48.1,
      longitude: 2.3,
    })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'North Dock')
    assert.equal(response.body().data.latitude, 48.1)
    assert.equal(response.body().data.longitude, 2.3)
    assert.equal(response.body().data.status, 'AVAILABLE')
    assert.deepEqual(Object.keys(response.body().data).sort(), [
      'createdAt',
      'id',
      'latitude',
      'longitude',
      'name',
      'status',
      'updatedAt',
    ])
  })

  test('rejects invalid dock coordinates during creation', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/docks')
      .loginAs(admin)
      .json({ name: 'Invalid', latitude: 91, longitude: 0 })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'latitude')
  })

  test('rejects unauthenticated and unauthorized dock listing', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const unauthenticatedResponse = await client.get('/api/v1/docks')
    const unauthorizedResponse = await client.get('/api/v1/docks').loginAs(observer)

    unauthenticatedResponse.assertStatus(401)
    assert.equal(unauthenticatedResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorizedResponse.assertStatus(403)
    assert.equal(unauthorizedResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('lists available and archived docks', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const available = await DockFactory.merge({ name: 'Selectable Dock' }).create()
    const archived = await DockFactory.apply('archived').merge({ name: 'Retired Dock' }).create()
    const response = await client.get('/api/v1/docks').loginAs(admin)

    response.assertStatus(200)
    assert.includeMembers(
      response.body().data.map((dock: { id: string }) => dock.id),
      [available.id, archived.id],
    )
  })

  test('rejects unauthenticated access to available docks', async ({ assert, client }) => {
    const response = await client.get('/api/v1/docks/available')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('lists only available docks for active users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const available = await DockFactory.merge({ name: 'Available Dock' }).create()
    const archived = await DockFactory.apply('archived').merge({ name: 'Archived Dock' }).create()
    const response = await client.get('/api/v1/docks/available').loginAs(observer)

    response.assertStatus(200)
    assert.include(
      response.body().data.map((dock: { id: string }) => dock.id),
      available.id,
    )
    assert.notInclude(
      response.body().data.map((dock: { id: string }) => dock.id),
      archived.id,
    )
  })

  test('rejects unauthenticated dock inspection', async ({ assert, client }) => {
    const dock = await DockFactory.create()
    const response = await client.get(`/api/v1/docks/${dock.id}`)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('shows an archived dock with its current coordinates', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const dock = await DockFactory.apply('archived')
      .merge({ name: 'Historic Dock', latitude: 48.4, longitude: 2.7 })
      .create()
    const response = await client.get(`/api/v1/docks/${dock.id}`).loginAs(observer)

    response.assertStatus(200)
    assert.equal(response.body().data.id, dock.id)
    assert.equal(response.body().data.status, 'ARCHIVED')
    assert.equal(response.body().data.latitude, 48.4)
    assert.equal(response.body().data.longitude, 2.7)
  })

  test('rejects unauthenticated and unauthorized dock updates', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const dock = await DockFactory.create()
    const unauthenticatedResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .json({ name: 'Updated' })
    const unauthorizedResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(observer)
      .json({ name: 'Updated' })

    unauthenticatedResponse.assertStatus(401)
    assert.equal(unauthenticatedResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorizedResponse.assertStatus(403)
    assert.equal(unauthorizedResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('updates a dock while preserving its identity', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Old Dock' }).create()
    const response = await client.patch(`/api/v1/docks/${dock.id}`).loginAs(admin).json({
      name: '  Updated Dock  ',
      latitude: 49,
    })

    response.assertStatus(200)
    assert.equal(response.body().data.id, dock.id)
    assert.equal(response.body().data.name, 'Updated Dock')
    assert.equal(response.body().data.latitude, 49)
  })

  test('rejects empty dock updates with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Validation Dock' }).create()
    const emptyUpdateResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({})
    const whitespaceNameResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: '   ', latitude: 49 })
    const emptyLatitudeResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: 'Valid Dock', latitude: '' })
    const emptyLongitudeResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: 'Valid Dock', longitude: '   ' })

    for (const [response, field] of [
      [emptyUpdateResponse, 'name'],
      [whitespaceNameResponse, 'name'],
      [emptyLatitudeResponse, 'latitude'],
      [emptyLongitudeResponse, 'longitude'],
    ] as const) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.equal(response.body().error.details[0].field, field)
      assert.equal(response.body().error.details[0].rule, 'required')
    }
  })

  test('rejects unauthenticated and unauthorized dock archival', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const dock = await DockFactory.create()
    const unauthenticatedResponse = await client.post(`/api/v1/docks/${dock.id}/archive`).json({})
    const unauthorizedResponse = await client
      .post(`/api/v1/docks/${dock.id}/archive`)
      .loginAs(observer)
      .json({})

    unauthenticatedResponse.assertStatus(401)
    assert.equal(unauthenticatedResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorizedResponse.assertStatus(403)
    assert.equal(unauthorizedResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('archives a dock with lifecycle metadata', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Lifecycle Dock' }).create()
    const response = await client
      .post(`/api/v1/docks/${dock.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Retired' })

    response.assertStatus(200)
    assert.equal(response.body().data.id, dock.id)
    assert.equal(response.body().data.status, 'ARCHIVED')
    assert.equal(response.body().data.archiveComment, 'Retired')
    assert.equal(response.body().data.archivedByUserId, admin.id)
  })

  test('rejects unauthenticated and unauthorized dock reactivation', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const dock = await DockFactory.apply('archived').create()
    const unauthenticatedResponse = await client
      .post(`/api/v1/docks/${dock.id}/reactivate`)
      .json({})
    const unauthorizedResponse = await client
      .post(`/api/v1/docks/${dock.id}/reactivate`)
      .loginAs(observer)
      .json({})

    unauthenticatedResponse.assertStatus(401)
    assert.equal(unauthenticatedResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorizedResponse.assertStatus(403)
    assert.equal(unauthorizedResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('reactivates the same dock identity with lifecycle metadata', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.apply('archived').merge({ name: 'Returning Dock' }).create()
    const response = await client
      .post(`/api/v1/docks/${dock.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Returning' })

    response.assertStatus(200)
    assert.equal(response.body().data.id, dock.id)
    assert.equal(response.body().data.status, 'AVAILABLE')
    assert.equal(response.body().data.reactivationComment, 'Returning')
    assert.equal(response.body().data.reactivatedByUserId, admin.id)
  })
})
