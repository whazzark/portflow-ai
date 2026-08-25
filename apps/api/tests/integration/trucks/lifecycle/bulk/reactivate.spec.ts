import { test } from '@japa/runner'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createArchivedTruckWithArchivedCompanyScenario } from '../../../../support/trucks/lifecycle_fixtures.ts'

test.group('POST /api/v1/trucks/reactivate', () => {
  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const truck = await TruckFactory.apply('archived').create()
    const response = await client.post('/api/v1/trucks/reactivate').json({ ids: [truck.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const truck = await TruckFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/trucks/reactivate')
      .loginAs(observer)
      .json({ ids: [truck.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('rejects an empty ids array', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client.post('/api/v1/trucks/reactivate').loginAs(admin).json({ ids: [] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/trucks/reactivate')
      .loginAs(admin)
      .json({ ids: [truck.id, truck.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/trucks/reactivate')
      .loginAs(admin)
      .json({ ids: [truck.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
  })

  test('reactivates multiple trucks with a shared comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TruckFactory.apply('archived').create()
    const second = await TruckFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/trucks/reactivate')
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: '  Winter fleet back in service  ' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedTrucks.map((truck: { id: string }) => truck.id),
      [first.id, second.id],
    )
    assert.isTrue(
      response
        .body()
        .data.updatedTrucks.every(
          (truck: { status: string; reactivationComment: string }) =>
            truck.status === 'AVAILABLE' &&
            truck.reactivationComment === 'Winter fleet back in service',
        ),
    )
  })

  test('reports a mix of archived-transport-company, missing, and already-available blockers in request order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck: blockedByCompany } = await createArchivedTruckWithArchivedCompanyScenario()
    const alreadyAvailable = await TruckFactory.create()
    const eligible = await TruckFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    const response = await client
      .post('/api/v1/trucks/reactivate')
      .loginAs(admin)
      .json({ ids: [blockedByCompany.id, missingId, alreadyAvailable.id, eligible.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedTrucks.map((truck: { id: string }) => truck.id),
      [eligible.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedTrucks.map((truck: { id: string; reason: string }) => [
          truck.id,
          truck.reason,
        ]),
      [
        [blockedByCompany.id, 'TRANSPORT_COMPANY_ARCHIVED'],
        [missingId, 'NOT_FOUND'],
        [alreadyAvailable.id, 'ALREADY_AVAILABLE'],
      ],
    )
    await blockedByCompany.refresh()
    assert.equal(blockedByCompany.status, 'ARCHIVED')
  })

  test('reactivates nothing and reports every truck as blocked when all are ineligible', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TruckFactory.create()
    const second = await TruckFactory.create()
    const response = await client
      .post('/api/v1/trucks/reactivate')
      .loginAs(admin)
      .json({ ids: [first.id, second.id] })

    response.assertStatus(200)
    assert.isEmpty(response.body().data.updatedTrucks)
    assert.equal(response.body().data.blockedTrucks.length, 2)
  })

  test('reactivates each shared truck exactly once across two overlapping concurrent submissions', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await TruckFactory.apply('archived').create()
    const onlyInFirst = await TruckFactory.apply('archived').create()
    const onlyInSecond = await TruckFactory.apply('archived').create()

    const [first, second] = await Promise.all([
      client
        .post('/api/v1/trucks/reactivate')
        .loginAs(admin)
        .json({ ids: [shared.id, onlyInFirst.id] }),
      client
        .post('/api/v1/trucks/reactivate')
        .loginAs(admin)
        .json({ ids: [shared.id, onlyInSecond.id] }),
    ])

    first.assertStatus(200)
    second.assertStatus(200)

    await shared.refresh()
    assert.equal(shared.status, 'AVAILABLE')

    const firstUpdatedIds = first.body().data.updatedTrucks.map((truck: { id: string }) => truck.id)
    const secondUpdatedIds = second
      .body()
      .data.updatedTrucks.map((truck: { id: string }) => truck.id)
    const sharedReactivatedByFirst = firstUpdatedIds.includes(shared.id)
    const sharedReactivatedBySecond = secondUpdatedIds.includes(shared.id)
    assert.notEqual(sharedReactivatedByFirst, sharedReactivatedBySecond)
  })
})
