import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import PlannedOrActiveUsageChecker from '#site_references/shared/planned_or_active_usage_checker'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('Docks administration', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated creation', async ({ assert, client }) => {
    const response = await client
      .post('/api/v1/docks')
      .json({ name: 'North', latitude: 1, longitude: 2 })
    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects mutations for non-admin users', async ({ client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client
      .post('/api/v1/docks')
      .loginAs(observer)
      .json({ name: 'North', latitude: 1, longitude: 2 })
    response.assertStatus(403)
  })

  test('creates, updates, lists, and exposes a normalized dock', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const createResponse = await client.post('/api/v1/docks').loginAs(admin).json({
      name: '  North Dock  ',
      latitude: 48.1,
      longitude: 2.3,
    })
    createResponse.assertStatus(201)
    assert.equal(createResponse.body().data.name, 'North Dock')
    assert.equal(createResponse.body().data.latitude, 48.1)
    assert.equal(createResponse.body().data.longitude, 2.3)
    assert.equal(createResponse.body().data.status, 'AVAILABLE')
    assert.deepEqual(Object.keys(createResponse.body().data).sort(), [
      'createdAt',
      'id',
      'latitude',
      'longitude',
      'name',
      'status',
      'updatedAt',
    ])

    const id = createResponse.body().data.id
    const updateResponse = await client
      .patch(`/api/v1/docks/${id}`)
      .loginAs(admin)
      .json({ latitude: 49 })
    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().data.id, id)
    assert.equal(updateResponse.body().data.latitude, 49)

    const listResponse = await client.get('/api/v1/docks').loginAs(admin)
    listResponse.assertStatus(200)
    assert.include(
      listResponse.body().data.map((dock: { id: string }) => dock.id),
      id,
    )
  })

  test('keeps archived docks readable but excludes them from available selections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const archived = await DockFactory.apply('archived').merge({ name: 'Archived Dock' }).create()
    const available = await DockFactory.merge({ name: 'Available Dock' }).create()
    const listResponse = await client.get('/api/v1/docks').loginAs(admin)
    const availableResponse = await client.get('/api/v1/docks/available').loginAs(admin)
    const showResponse = await client.get(`/api/v1/docks/${archived.id}`).loginAs(admin)

    listResponse.assertStatus(200)
    availableResponse.assertStatus(200)
    showResponse.assertStatus(200)
    assert.include(
      listResponse.body().data.map((dock: { id: string }) => dock.id),
      archived.id,
    )
    assert.include(
      availableResponse.body().data.map((dock: { id: string }) => dock.id),
      available.id,
    )
    assert.notInclude(
      availableResponse.body().data.map((dock: { id: string }) => dock.id),
      archived.id,
    )
    assert.equal(showResponse.body().data.status, 'ARCHIVED')
  })

  test('archives and reactivates a dock with lifecycle metadata', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Lifecycle Dock' }).create()
    const archiveResponse = await client
      .post(`/api/v1/docks/${dock.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Retired' })
    archiveResponse.assertStatus(200)
    assert.equal(archiveResponse.body().data.status, 'ARCHIVED')
    assert.equal(archiveResponse.body().data.archiveComment, 'Retired')
    assert.equal(archiveResponse.body().data.archivedByUserId, admin.id)

    const reactivateResponse = await client
      .post(`/api/v1/docks/${dock.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Returning' })
    reactivateResponse.assertStatus(200)
    assert.equal(reactivateResponse.body().data.id, dock.id)
    assert.equal(reactivateResponse.body().data.status, 'AVAILABLE')
    assert.equal(reactivateResponse.body().data.reactivationComment, 'Returning')
  })

  test('maps validation, uniqueness, archived updates, and usage conflicts', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Conflict Dock' }).create()
    const invalid = await client
      .post('/api/v1/docks')
      .loginAs(admin)
      .json({ name: 'Invalid', latitude: 91, longitude: 0 })
    const duplicate = await client
      .post('/api/v1/docks')
      .loginAs(admin)
      .json({ name: ' conflict dock ', latitude: 0, longitude: 0 })
    const archived = await DockFactory.apply('archived').merge({ name: 'Read Only Dock' }).create()
    const archivedUpdate = await client
      .patch(`/api/v1/docks/${archived.id}`)
      .loginAs(admin)
      .json({ name: 'Changed' })
    app.container.swap(SiteReferenceUsageChecker, () =>
      app.container.make(PlannedOrActiveUsageChecker),
    )
    const inUse = await client.post(`/api/v1/docks/${dock.id}/archive`).loginAs(admin).json({})

    invalid.assertStatus(422)
    duplicate.assertStatus(409)
    archivedUpdate.assertStatus(409)
    inUse.assertStatus(409)
    assert.equal(archivedUpdate.body().error.code, 'E_DOCK_ARCHIVED')
    assert.equal(inUse.body().error.code, 'E_DOCK_IN_USE')
  })

  test('rejects an empty update with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.merge({ name: 'Validation Dock' }).create()
    const response = await client.patch(`/api/v1/docks/${dock.id}`).loginAs(admin).json({})

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'name')
    assert.equal(response.body().error.details[0].rule, 'required')
  })
})
