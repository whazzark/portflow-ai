import { test } from '@japa/runner'

import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('POST /api/v1/docks/reactivate', () => {
  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const dock = await DockFactory.apply('archived').create()
    const response = await client.post('/api/v1/docks/reactivate').json({ ids: [dock.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects requests from a user whose access is not active', async ({ assert, client }) => {
    const suspended = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const dock = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(suspended)
      .json({ ids: [dock.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await dock.refresh()
    assert.equal(dock.status, 'ARCHIVED')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const dock = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(observer)
      .json({ ids: [dock.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty selection before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client.post('/api/v1/docks/reactivate').loginAs(admin).json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [dock.id, dock.id] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await dock.refresh()
    assert.equal(dock.status, 'ARCHIVED')
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [dock.id, dock.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await dock.refresh()
    assert.equal(dock.status, 'ARCHIVED')
  })

  test('rejects a malformed id before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [dock.id, 'not-a-uuid'] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await dock.refresh()
    assert.equal(dock.status, 'ARCHIVED')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [dock.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await dock.refresh()
    assert.equal(dock.status, 'ARCHIVED')
  })

  test('reactivates multiple docks with a shared comment, actor, and timestamp', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await DockFactory.apply('archived').create()
    const second = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({
        ids: [first.id, second.id],
        comment: '  Quay reopened  ',
      })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedDocks.map((dock: { id: string }) => dock.id),
      [first.id, second.id],
    )
    const [firstResult, secondResult] = response.body().data.updatedDocks
    assert.equal(firstResult.status, 'AVAILABLE')
    assert.equal(secondResult.status, 'AVAILABLE')
    assert.equal(firstResult.reactivationComment, 'Quay reopened')
    assert.equal(secondResult.reactivationComment, 'Quay reopened')
    assert.equal(firstResult.reactivatedByUserId, admin.id)
    assert.equal(secondResult.reactivatedByUserId, admin.id)
    assert.equal(firstResult.reactivatedAt, secondResult.reactivatedAt)
  })

  test('preserves identity, position, creation time, and archive metadata through reactivation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archivedBy = await UserFactory.apply('active').create()
    const dock = await DockFactory.apply('archived')
      .merge({
        name: 'Bulk Returning Dock',
        latitude: 46.1591,
        longitude: -1.2264,
        archivedByUserId: archivedBy.id,
        archiveComment: 'Quay closed for resurfacing',
      })
      .create()
    await dock.refresh()
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [dock.id] })

    response.assertStatus(200)
    const [result] = response.body().data.updatedDocks
    assert.equal(result.id, dock.id)
    assert.equal(result.name, 'Bulk Returning Dock')
    assert.equal(result.latitude, 46.1591)
    assert.equal(result.longitude, -1.2264)
    assert.equal(result.createdAt, dock.createdAt.toISO())
    assert.equal(result.archivedByUserId, archivedBy.id)
    assert.equal(result.archiveComment, 'Quay closed for resurfacing')
  })

  test('reports already available and missing docks separately, in request order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await DockFactory.create()
    const archived = await DockFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [available.id, missingId, archived.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedDocks.map((dock: { id: string }) => dock.id),
      [archived.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedDocks.map((dock: { id: string; reason: string }) => [dock.id, dock.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        [missingId, 'NOT_FOUND'],
      ],
    )
    await available.refresh()
    assert.isNull(available.reactivatedAt)
  })

  test('reports every entry as blocked, not a validation error, when the whole selection is ineligible', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await DockFactory.create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/docks/reactivate')
      .loginAs(admin)
      .json({ ids: [available.id, missingId] })

    response.assertStatus(200)
    assert.deepEqual(response.body().data.updatedDocks, [])
    assert.deepEqual(
      response
        .body()
        .data.blockedDocks.map((dock: { id: string; reason: string }) => [dock.id, dock.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        [missingId, 'NOT_FOUND'],
      ],
    )
  })

  test('reactivates exactly one dock when two overlapping requests race for it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await DockFactory.apply('archived').create()
    const other = await DockFactory.apply('archived').create()

    const [first, second] = await Promise.all([
      client
        .post('/api/v1/docks/reactivate')
        .loginAs(admin)
        .json({ ids: [shared.id, other.id], comment: 'First request' }),
      client
        .post('/api/v1/docks/reactivate')
        .loginAs(admin)
        .json({ ids: [shared.id], comment: 'Second request' }),
    ])

    const outcomes = [first, second].map((response) => ({
      updated: response.body().data.updatedDocks.map((dock: { id: string }) => dock.id),
      blocked: response.body().data.blockedDocks.map((dock: { id: string }) => dock.id),
    }))
    const successes = outcomes.filter((outcome) => outcome.updated.includes(shared.id))
    const blocks = outcomes.filter((outcome) => outcome.blocked.includes(shared.id))

    assert.lengthOf(successes, 1)
    assert.lengthOf(blocks, 1)
    await shared.refresh()
    assert.equal(shared.status, 'AVAILABLE')
    assert.isNotNull(shared.reactivationComment)
  })
})
