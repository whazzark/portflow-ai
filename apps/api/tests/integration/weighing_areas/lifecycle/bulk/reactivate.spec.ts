import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import { createPersistedWeighingAreaUsageScenario } from '../../../../support/persisted_weighing_area_usage.js'

const MISSING_ID = '00000000-0000-4000-8000-000000000000'

test.group('POST /api/v1/weighing-areas/reactivate', () => {
  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const area = await WeighingAreaFactory.apply('archived').create()
    const response = await client.post('/api/v1/weighing-areas/reactivate').json({ ids: [area.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(observer)
      .json({ ids: [area.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
  })

  test('rejects users whose access is not active', async ({ assert, client }) => {
    const deactivated = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const area = await WeighingAreaFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(deactivated)
      .json({ ids: [area.id] })

    assert.isAtLeast(response.status(), 400)
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
  })

  test('allows both administrator roles', async ({ assert, client }) => {
    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).create()
      const area = await WeighingAreaFactory.apply('archived').create()
      const response = await client
        .post('/api/v1/weighing-areas/reactivate')
        .loginAs(admin)
        .json({ ids: [area.id] })

      response.assertStatus(200)
      assert.deepEqual(
        response.body().data.updatedWeighingAreas.map((item: { id: string }) => item.id),
        [area.id],
      )
    }
  })

  test('reactivates multiple weighing areas with a shared comment, actor, and timestamp', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await WeighingAreaFactory.apply('archived').create()
    const second = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: '  Weighing lane reopened  ' })

    response.assertStatus(200)
    const updated = response.body().data.updatedWeighingAreas
    assert.deepEqual(
      updated.map((area: { id: string }) => area.id),
      [first.id, second.id],
    )
    assert.isTrue(
      updated.every(
        (area: { status: string; reactivationComment: string; reactivatedByUserId: string }) =>
          area.status === 'AVAILABLE' &&
          area.reactivationComment === 'Weighing lane reopened' &&
          area.reactivatedByUserId === admin.id,
      ),
    )
    // One timestamp is taken for the whole submission, so every reactivated area shares it.
    assert.lengthOf(
      new Set(updated.map((area: { reactivatedAt: string }) => area.reactivatedAt)),
      1,
    )
    assert.deepEqual(response.body().data.blockedWeighingAreas, [])
  })

  test('stores no comment when the shared comment is whitespace only', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [area.id], comment: '   ' })

    response.assertStatus(200)
    assert.isNull(response.body().data.updatedWeighingAreas[0].reactivationComment)
  })

  test('preserves request order across missing and already available blockers', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await WeighingAreaFactory.create()
    const archived = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [available.id, MISSING_ID, archived.id], comment: 'Reopening' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      [archived.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedWeighingAreas.map((area: { id: string; reason: string }) => [
          area.id,
          area.reason,
        ]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        [MISSING_ID, 'NOT_FOUND'],
      ],
    )
    // A resolved blocker carries its name so the administrator can identify it; an unresolved one
    // cannot, because nothing was found to name.
    const blocked = response.body().data.blockedWeighingAreas
    assert.equal(blocked[0].name, available.name)
    assert.isUndefined(blocked[1].name)
    // Blocked entries are left completely untouched.
    await available.refresh()
    assert.isNull(available.reactivationComment)
  })

  test('reports every entry as blocked, not a validation error, when the whole selection is ineligible', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await WeighingAreaFactory.create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [available.id, MISSING_ID] })

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
        [available.id, 'ALREADY_AVAILABLE'],
        [MISSING_ID, 'NOT_FOUND'],
      ],
    )
  })

  test('preserves identity and archive context while recording reactivation context', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const archivedBy = await UserFactory.apply('active').create()
    const area = await WeighingAreaFactory.apply('archived')
      .merge({
        name: 'Lane Two Scale',
        latitude: 47.5,
        longitude: 3.25,
        archivedByUserId: archivedBy.id,
        archiveComment: 'Lane closed for works',
      })
      .create()
    await area.refresh()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [area.id], comment: 'Works finished' })

    response.assertStatus(200)
    const body = response.body().data.updatedWeighingAreas[0]
    assert.equal(body.id, area.id)
    assert.equal(body.name, 'Lane Two Scale')
    assert.equal(body.latitude, 47.5)
    assert.equal(body.longitude, 3.25)
    assert.equal(body.createdAt, area.createdAt.toISO())
    assert.equal(body.archivedByUserId, archivedBy.id)
    assert.equal(body.archiveComment, 'Lane closed for works')
    assert.isNotNull(body.archivedAt)
    assert.equal(body.status, 'AVAILABLE')
    assert.equal(body.reactivationComment, 'Works finished')
  })

  test('never reports IN_USE and leaves historical references intact', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    // A weighing area that was archived while a closed discharge referenced it: reactivation must
    // not consult usage at all, so no IN_USE blocker can arise on this path.
    const { weighingArea: referenced } = await createPersistedWeighingAreaUsageScenario({
      status: 'CLOSED',
    })
    referenced.status = 'ARCHIVED'
    await referenced.save()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [referenced.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      [referenced.id],
    )
    assert.deepEqual(response.body().data.blockedWeighingAreas, [])
  })

  test('rejects an empty selection before evaluating anything', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
  })

  test('rejects duplicate IDs before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [area.id, area.id] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
    assert.isNull(area.reactivatedAt)
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [area.id, area.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
  })

  test('rejects a malformed id before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [area.id, 'not-a-uuid'] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    // Deliberately distinct from a well-formed-but-unknown id, which comes back per entry as
    // NOT_FOUND with the rest of the selection still reactivated.
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/reactivate')
      .loginAs(admin)
      .json({ ids: [area.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
    assert.isNull(area.reactivationComment)
  })

  test('reactivates exactly one weighing area when two overlapping requests race for it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await WeighingAreaFactory.apply('archived').create()
    const other = await WeighingAreaFactory.apply('archived').create()

    const [first, second] = await Promise.all([
      client
        .post('/api/v1/weighing-areas/reactivate')
        .loginAs(admin)
        .json({ ids: [shared.id, other.id], comment: 'First writer' }),
      client
        .post('/api/v1/weighing-areas/reactivate')
        .loginAs(admin)
        .json({ ids: [shared.id], comment: 'Second writer' }),
    ])

    const outcomes = [first, second].map((response) => ({
      updated: response.body().data.updatedWeighingAreas.map((area: { id: string }) => area.id),
      blocked: response
        .body()
        .data.blockedWeighingAreas.map((area: { id: string; reason: string }) => [
          area.id,
          area.reason,
        ]),
    }))
    const successes = outcomes.filter((outcome) => outcome.updated.includes(shared.id))
    const blocks = outcomes.filter((outcome) =>
      outcome.blocked.some(
        ([id, reason]: [string, string]) => id === shared.id && reason === 'ALREADY_AVAILABLE',
      ),
    )

    assert.lengthOf(successes, 1)
    assert.lengthOf(blocks, 1)
    await shared.refresh()
    assert.equal(shared.status, 'AVAILABLE')
    // Exactly one reactivation is recorded: the loser never overwrites the winner's comment.
    assert.oneOf(shared.reactivationComment, ['First writer', 'Second writer'])
  })
})
