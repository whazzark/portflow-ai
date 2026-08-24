import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { createReservedTruckScenario } from '../../../../support/trucks/lifecycle_fixtures.ts'

test.group('POST /api/v1/trucks/archive', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const truck = await TruckFactory.create()
    const response = await client.post('/api/v1/trucks/archive').json({ ids: [truck.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post('/api/v1/trucks/archive')
      .loginAs(observer)
      .json({ ids: [truck.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty ids array', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client.post('/api/v1/trucks/archive').loginAs(admin).json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post('/api/v1/trucks/archive')
      .loginAs(admin)
      .json({ ids: [truck.id, truck.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post('/api/v1/trucks/archive')
      .loginAs(admin)
      .json({ ids: [truck.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('archives multiple trucks with a shared comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TruckFactory.create()
    const second = await TruckFactory.create()
    const response = await client
      .post('/api/v1/trucks/archive')
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: '  Fleet cleanup  ' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedTrucks.map((truck: { id: string }) => truck.id),
      [first.id, second.id],
    )
    assert.isTrue(
      response
        .body()
        .data.updatedTrucks.every(
          (truck: { status: string; archiveComment: string }) =>
            truck.status === 'ARCHIVED' && truck.archiveComment === 'Fleet cleanup',
        ),
    )
  })

  test('reports a mix of in-use, missing, and already-archived blockers in request order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck: used } = await createReservedTruckScenario({ status: 'ACTIVE' })
    const available = await TruckFactory.create()
    const archived = await TruckFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/trucks/archive')
      .loginAs(admin)
      .json({ ids: [used.id, missingId, archived.id, available.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedTrucks.map((truck: { id: string }) => truck.id),
      [available.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedTrucks.map((truck: { id: string; reason: string }) => [
          truck.id,
          truck.reason,
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

  test('archives nothing and reports every truck as blocked when all are ineligible', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TruckFactory.apply('archived').create()
    const second = await TruckFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/trucks/archive')
      .loginAs(admin)
      .json({ ids: [first.id, second.id] })

    response.assertStatus(200)
    assert.isEmpty(response.body().data.updatedTrucks)
    assert.equal(response.body().data.blockedTrucks.length, 2)
  })

  test('archives each shared truck exactly once across two overlapping concurrent submissions', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await TruckFactory.create()
    const onlyInFirst = await TruckFactory.create()
    const onlyInSecond = await TruckFactory.create()

    const [first, second] = await Promise.all([
      client
        .post('/api/v1/trucks/archive')
        .loginAs(admin)
        .json({ ids: [shared.id, onlyInFirst.id] }),
      client
        .post('/api/v1/trucks/archive')
        .loginAs(admin)
        .json({ ids: [shared.id, onlyInSecond.id] }),
    ])

    first.assertStatus(200)
    second.assertStatus(200)

    await shared.refresh()
    assert.equal(shared.status, 'ARCHIVED')

    const firstUpdatedIds = first.body().data.updatedTrucks.map((truck: { id: string }) => truck.id)
    const secondUpdatedIds = second
      .body()
      .data.updatedTrucks.map((truck: { id: string }) => truck.id)
    const sharedArchivedByFirst = firstUpdatedIds.includes(shared.id)
    const sharedArchivedBySecond = secondUpdatedIds.includes(shared.id)
    assert.notEqual(sharedArchivedByFirst, sharedArchivedBySecond)
  })
})
