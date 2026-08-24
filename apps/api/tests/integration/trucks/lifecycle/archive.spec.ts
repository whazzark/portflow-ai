import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import {
  createClosedDischargeTruckScenario,
  createReleasedTruckScenario,
  createReservedTruckScenario,
} from '../../../support/trucks/lifecycle_fixtures.ts'

test.group('POST /api/v1/trucks/:id/archive', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated archival', async ({ assert, client }) => {
    const truck = await TruckFactory.create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/archive`).json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects archival for non-admin active roles', async ({ assert, client }) => {
    for (const role of ['OBSERVER', 'OPERATIONS_LEAD'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const truck = await TruckFactory.create()
      const response = await client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(user)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await truck.refresh()
      assert.equal(truck.status, 'AVAILABLE')
    }
  })

  test('archives a truck with lifecycle metadata and a populated archivedBy', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/archive`)
      .loginAs(admin)
      .json({ comment: '  Returned to the leasing company  ' })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.status, 'ARCHIVED')
    assert.equal(data.archiveComment, 'Returned to the leasing company')
    assert.equal(data.archivedByUserId, admin.id)
    assert.isNotNull(data.archivedAt)
    assert.equal(data.archivedBy.id, admin.id)
    assert.equal(data.registration, truck.registration)
    assert.equal(data.transportCompanyId, truck.transportCompanyId)
  })

  test('archives a truck without a comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({})

    response.assertStatus(200)
    assert.isNull(response.body().data.archiveComment)
  })

  test('excludes an archived truck from available consultation and keeps it in the complete list', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    await client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({})

    const available = await client.get('/api/v1/trucks/available').loginAs(admin)
    assert.isFalse(
      (available.body().data as Array<{ id: string }>).some((item) => item.id === truck.id),
    )

    const complete = await client.get('/api/v1/trucks').loginAs(admin)
    const listed = (complete.body().data as Array<{ id: string; status: string }>).find(
      (item) => item.id === truck.id,
    )
    assert.equal(listed?.status, 'ARCHIVED')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('rejects archival of an unknown truck', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/trucks/00000000-0000-0000-0000-000000000000/archive')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRUCK_NOT_FOUND')
  })

  test('rejects archival of an already-archived truck and leaves its context unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Trying again' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_ALREADY_ARCHIVED')
    await truck.refresh()
    assert.notEqual(truck.archiveComment, 'Trying again')
  })

  test('rejects archival when the truck is reserved by a planned or active discharge', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    for (const status of ['PLANNED', 'ACTIVE'] as const) {
      const { truck } = await createReservedTruckScenario({ status })
      const response = await client
        .post(`/api/v1/trucks/${truck.id}/archive`)
        .loginAs(admin)
        .json({})

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_TRUCK_IN_USE')
      await truck.refresh()
      assert.equal(truck.status, 'AVAILABLE')
      assert.isNull(truck.archivedAt)
      assert.isNull(truck.archivedByUserId)
      assert.isNull(truck.archiveComment)
    }
  })

  test('allows archival when the only usage is a released assignment', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck } = await createReleasedTruckScenario()
    const response = await client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test('allows archival when the only usage belongs to a closed discharge', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck } = await createClosedDischargeTruckScenario()
    const response = await client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test("allows archival when the truck's transport company is archived", async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const truck = await TruckFactory.merge({ transportCompanyId: archivedCompany.id }).create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test('collapses two near-simultaneous archival attempts into exactly one archival', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()

    const [first, second] = await Promise.all([
      client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({ comment: 'first' }),
      client.post(`/api/v1/trucks/${truck.id}/archive`).loginAs(admin).json({ comment: 'second' }),
    ])

    const statuses = [first.status(), second.status()].sort()
    assert.deepEqual(statuses, [200, 409])

    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
    const winner = first.status() === 200 ? first : second
    assert.equal(truck.archiveComment, winner.body().data.archiveComment)
  })
})
