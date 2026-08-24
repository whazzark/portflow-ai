import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { createPersistedDockUsageScenario } from '../../../../support/persisted_dock_usage.js'

test.group('POST /api/v1/docks/archive', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const dock = await DockFactory.create()
    const response = await client.post('/api/v1/docks/archive').json({ ids: [dock.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const dock = await DockFactory.create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(observer)
      .json({ ids: [dock.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty selection before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client.post('/api/v1/docks/archive').loginAs(admin).json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [dock.id, dock.id] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [dock.id, dock.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await dock.refresh()
    assert.equal(dock.status, 'AVAILABLE')
  })

  test('rejects a malformed id before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [dock.id, 'not-a-uuid'] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await dock.refresh()
    assert.equal(dock.status, 'AVAILABLE')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const dock = await DockFactory.create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [dock.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await dock.refresh()
    assert.equal(dock.status, 'AVAILABLE')
  })

  test('archives multiple docks with a shared comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await DockFactory.create()
    const second = await DockFactory.create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({
        ids: [first.id, second.id],
        comment: '  Site reorganization  ',
      })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedDocks.map((dock: { id: string }) => dock.id),
      [first.id, second.id],
    )
    assert.isTrue(
      response
        .body()
        .data.updatedDocks.every(
          (dock: { status: string; archiveComment: string }) =>
            dock.status === 'ARCHIVED' && dock.archiveComment === 'Site reorganization',
        ),
    )
  })

  test('reports already archived docks separately', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await DockFactory.create()
    const archived = await DockFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [available.id, archived.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedDocks.map((dock: { id: string }) => dock.id),
      [available.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedDocks.map((dock: { id: string; reason: string }) => [dock.id, dock.reason]),
      [[archived.id, 'ALREADY_ARCHIVED']],
    )
  })

  test('preserves request order across persisted in-use, missing, and already archived blockers', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { dock: used } = await createPersistedDockUsageScenario({ status: 'ACTIVE' })
    const available = await DockFactory.create()
    const archived = await DockFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [used.id, missingId, archived.id, available.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedDocks.map((dock: { id: string }) => dock.id),
      [available.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedDocks.map((dock: { id: string; reason: string }) => [dock.id, dock.reason]),
      [
        [used.id, 'IN_USE'],
        [missingId, 'NOT_FOUND'],
        [archived.id, 'ALREADY_ARCHIVED'],
      ],
    )
    await used.refresh()
    assert.equal(used.status, 'AVAILABLE')
  })

  test('reports every entry as blocked, not a validation error, when the whole selection is ineligible', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archived = await DockFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/docks/archive')
      .loginAs(admin)
      .json({ ids: [archived.id, missingId] })

    response.assertStatus(200)
    assert.deepEqual(response.body().data.updatedDocks, [])
    assert.deepEqual(
      response
        .body()
        .data.blockedDocks.map((dock: { id: string; reason: string }) => [dock.id, dock.reason]),
      [
        [archived.id, 'ALREADY_ARCHIVED'],
        [missingId, 'NOT_FOUND'],
      ],
    )
  })

  test('archives exactly one dock when two overlapping requests race for it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await DockFactory.create()
    const other = await DockFactory.create()

    const [first, second] = await Promise.all([
      client
        .post('/api/v1/docks/archive')
        .loginAs(admin)
        .json({ ids: [shared.id, other.id] }),
      client
        .post('/api/v1/docks/archive')
        .loginAs(admin)
        .json({ ids: [shared.id] }),
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
    assert.equal(shared.status, 'ARCHIVED')
  })
})
