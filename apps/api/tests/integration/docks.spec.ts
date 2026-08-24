import { test } from '@japa/runner'

import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createPersistedDockUsageScenario } from '../support/persisted_dock_usage.js'

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

  test('rejects whitespace-only dock names during creation', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/docks')
      .loginAs(admin)
      .json({ name: '   ', latitude: 48.1, longitude: 2.3 })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'name')
    assert.equal(response.body().error.details[0].rule, 'required')
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

  test('lists available and archived docks by name with the complete consultation DTO', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const available = await DockFactory.merge({ name: 'Zulu Dock' }).create()
    const archived = await DockFactory.apply('archived').merge({ name: 'Alpha Dock' }).create()
    const response = await client.get('/api/v1/docks').loginAs(admin)

    response.assertStatus(200)
    const createdIds = new Set([available.id, archived.id])
    const createdDocks = response
      .body()
      .data.filter((dock: { id: string }) => createdIds.has(dock.id))
    assert.deepEqual(
      createdDocks.map((dock: { id: string }) => dock.id),
      [archived.id, available.id],
    )
    assert.deepEqual(Object.keys(createdDocks[0]).sort(), [
      'archiveComment',
      'archivedAt',
      // biome-ignore lint/security/noSecrets: This is a public DTO field name, not a secret.
      'archivedByUserId',
      'createdAt',
      'id',
      'latitude',
      'longitude',
      'name',
      'reactivatedAt',
      'reactivatedByUserId',
      'reactivationComment',
      'status',
      'updatedAt',
    ])
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

  test('does not expose a dock item-detail route', async ({ client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const dock = await DockFactory.create()
    const response = await client.get(`/api/v1/docks/${dock.id}`).loginAs(admin)

    response.assertStatus(404)
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

  test('rejects duplicate dock names during updates, including case, whitespace, and archived docks', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const existingAvailable = await DockFactory.merge({ name: 'Existing Dock' }).create()
    const existingArchived = await DockFactory.apply('archived')
      .merge({ name: 'Archived Name' })
      .create()
    const dock = await DockFactory.merge({ name: 'Duplicate Target' }).create()

    const exactResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: existingAvailable.name })
    const caseAndWhitespaceResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: `  ${existingAvailable.name.toUpperCase()}  ` })
    const archivedNameResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: existingArchived.name })

    for (const response of [exactResponse, caseAndWhitespaceResponse, archivedNameResponse]) {
      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DOCK_NAME_CONFLICT')
    }

    const listResponse = await client.get('/api/v1/docks').loginAs(admin)
    const stored = listResponse.body().data.find((entry: { id: string }) => entry.id === dock.id)
    assert.equal(stored.name, 'Duplicate Target')
  })

  test('accepts resubmitting a dock own current name, exactly or with different casing, without conflict', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Self Name Dock' }).create()

    const exactResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: dock.name, latitude: dock.latitude, longitude: dock.longitude })

    exactResponse.assertStatus(200)
    assert.equal(exactResponse.body().data.name, dock.name)

    const differentCaseResponse = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: dock.name.toUpperCase() })

    differentCaseResponse.assertStatus(200)
    assert.equal(differentCaseResponse.body().data.name, dock.name.toUpperCase())
  })

  test('rejects out-of-range coordinates during updates and accepts the exact boundary values', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const outOfRangeDock = await DockFactory.create()

    const outOfRangeLatitude = await client
      .patch(`/api/v1/docks/${outOfRangeDock.id}`)
      .loginAs(admin)
      .json({ latitude: 91 })
    const outOfRangeLongitude = await client
      .patch(`/api/v1/docks/${outOfRangeDock.id}`)
      .loginAs(admin)
      .json({ longitude: -181 })

    for (const [response, field] of [
      [outOfRangeLatitude, 'latitude'],
      [outOfRangeLongitude, 'longitude'],
    ] as const) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.equal(response.body().error.details[0].field, field)
      // The `required` rule is already covered by the empty-update test above; this asserts the
      // *range* rule is actually exercised over HTTP, which was previously untested.
      assert.notEqual(response.body().error.details[0].rule, 'required')
    }

    for (const coordinates of [
      { latitude: 90 },
      { latitude: -90 },
      { longitude: 180 },
      { longitude: -180 },
    ]) {
      const boundaryDock = await DockFactory.create()
      const response = await client
        .patch(`/api/v1/docks/${boundaryDock.id}`)
        .loginAs(admin)
        .json(coordinates)

      response.assertStatus(200)
    }
  })

  test('rejects updates to an archived dock as read-only and leaves it unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.apply('archived')
      .merge({ name: 'Archived Update Target' })
      .create()

    const response = await client
      .patch(`/api/v1/docks/${dock.id}`)
      .loginAs(admin)
      .json({ name: 'Attempted Rename' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_DOCK_ARCHIVED')

    const listResponse = await client.get('/api/v1/docks').loginAs(admin)
    const stored = listResponse.body().data.find((entry: { id: string }) => entry.id === dock.id)
    assert.equal(stored.name, 'Archived Update Target')
    assert.equal(stored.status, 'ARCHIVED')
  })

  test('rejects updates to a dock that does not exist', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const missingDockId = '00000000-0000-4000-8000-000000000000'

    const response = await client
      .patch(`/api/v1/docks/${missingDockId}`)
      .loginAs(admin)
      .json({ name: 'Ghost Dock' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_DOCK_NOT_FOUND')
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

  test('rejects archival when a persisted planned or active discharge uses the dock', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    for (const status of ['PLANNED', 'ACTIVE'] as const) {
      const { dock } = await createPersistedDockUsageScenario({ status })
      const response = await client.post(`/api/v1/docks/${dock.id}/archive`).loginAs(admin).json({})

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DOCK_IN_USE')
      await dock.refresh()
      assert.equal(dock.status, 'AVAILABLE')
      assert.isNull(dock.archivedAt)
      assert.isNull(dock.archivedByUserId)
      assert.isNull(dock.archiveComment)
    }
  })

  test('allows archival when only a closed discharge references the dock', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { dock } = await createPersistedDockUsageScenario({ status: 'CLOSED' })
    const response = await client.post(`/api/v1/docks/${dock.id}/archive`).loginAs(admin).json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
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
