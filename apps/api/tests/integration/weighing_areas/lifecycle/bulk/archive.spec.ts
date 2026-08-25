import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { createPersistedWeighingAreaUsageScenario } from '../../../../support/persisted_weighing_area_usage.js'

test.group('POST /api/v1/weighing-areas/archive', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const area = await WeighingAreaFactory.create()
    const response = await client.post('/api/v1/weighing-areas/archive').json({ ids: [area.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(observer)
      .json({ ids: [area.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty selection before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [area.id, area.id] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [area.id, area.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'AVAILABLE')
  })

  test('rejects a malformed id before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [area.id, 'not-a-uuid'] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'AVAILABLE')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [area.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await area.refresh()
    assert.equal(area.status, 'AVAILABLE')
  })

  test('archives multiple weighing areas with a shared comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await WeighingAreaFactory.create()
    const second = await WeighingAreaFactory.create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({
        ids: [first.id, second.id],
        comment: '  End-of-campaign cleanup  ',
      })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      [first.id, second.id],
    )
    assert.isTrue(
      response
        .body()
        .data.updatedWeighingAreas.every(
          (area: { status: string; archiveComment: string }) =>
            area.status === 'ARCHIVED' && area.archiveComment === 'End-of-campaign cleanup',
        ),
    )
  })

  test('reports already archived weighing areas separately', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await WeighingAreaFactory.create()
    const archived = await WeighingAreaFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [available.id, archived.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      [available.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedWeighingAreas.map((area: { id: string; reason: string }) => [
          area.id,
          area.reason,
        ]),
      [[archived.id, 'ALREADY_ARCHIVED']],
    )
  })

  test('preserves request order across persisted in-use, missing, and already archived blockers', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { weighingArea: used } = await createPersistedWeighingAreaUsageScenario({
      status: 'ACTIVE',
    })
    const available = await WeighingAreaFactory.create()
    const archived = await WeighingAreaFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [used.id, missingId, archived.id, available.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      [available.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedWeighingAreas.map((area: { id: string; reason: string }) => [
          area.id,
          area.reason,
        ]),
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
    const archived = await WeighingAreaFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/weighing-areas/archive')
      .loginAs(admin)
      .json({ ids: [archived.id, missingId] })

    response.assertStatus(200)
    assert.deepEqual(response.body().data.updatedWeighingAreas, [])
    assert.deepEqual(
      response
        .body()
        .data.blockedWeighingAreas.map((area: { id: string; reason: string }) => [
          area.id,
          area.reason,
        ]),
      [
        [archived.id, 'ALREADY_ARCHIVED'],
        [missingId, 'NOT_FOUND'],
      ],
    )
  })

  test('archives exactly one weighing area when two overlapping requests race for it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await WeighingAreaFactory.create()
    const other = await WeighingAreaFactory.create()

    const [first, second] = await Promise.all([
      client
        .post('/api/v1/weighing-areas/archive')
        .loginAs(admin)
        .json({ ids: [shared.id, other.id] }),
      client
        .post('/api/v1/weighing-areas/archive')
        .loginAs(admin)
        .json({ ids: [shared.id] }),
    ])

    const outcomes = [first, second].map((response) => ({
      updated: response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      blocked: response.body().data.blockedWeighingAreas.map((area: { id: string }) => area.id),
    }))
    const successes = outcomes.filter((outcome) => outcome.updated.includes(shared.id))
    const blocks = outcomes.filter((outcome) => outcome.blocked.includes(shared.id))

    assert.lengthOf(successes, 1)
    assert.lengthOf(blocks, 1)
    await shared.refresh()
    assert.equal(shared.status, 'ARCHIVED')
  })
})
