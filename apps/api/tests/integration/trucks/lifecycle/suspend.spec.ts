import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UsedChecker from '#site_references/shared/used_checker'

import {
  createReservedAndShiftedTruckScenario,
  createReservedTruckScenario,
} from '../../../support/trucks/lifecycle_fixtures.ts'

test.group('POST /api/v1/trucks/:id/suspend', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated suspension', async ({ assert, client }) => {
    const truck = await TruckFactory.create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/suspend`).json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('rejects suspension for non-admin active roles', async ({ assert, client }) => {
    for (const role of ['OBSERVER', 'OPERATIONS_LEAD'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const truck = await TruckFactory.create()
      const response = await client.post(`/api/v1/trucks/${truck.id}/suspend`).loginAs(user)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await truck.refresh()
      assert.equal(truck.status, 'AVAILABLE')
    }
  })

  test('suspends a truck for both administrator roles', async ({ assert, client }) => {
    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).create()
      const truck = await TruckFactory.create()
      const response = await client
        .post(`/api/v1/trucks/${truck.id}/suspend`)
        .loginAs(admin)
        .json({ comment: '  Gearbox failure, in the workshop  ' })

      response.assertStatus(200)
      const data = response.body().data
      assert.equal(data.status, 'SUSPENDED')
      assert.equal(data.suspensionComment, 'Gearbox failure, in the workshop')
      assert.equal(data.suspendedByUserId, admin.id)
      assert.isNotNull(data.suspendedAt)
      assert.equal(data.suspendedBy.id, admin.id)
      assert.equal(data.registration, truck.registration)
      assert.equal(data.transportCompanyId, truck.transportCompanyId)
    }
  })

  test('suspends a truck without a comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/suspend`).loginAs(admin).json({})

    response.assertStatus(200)
    assert.isNull(response.body().data.suspensionComment)
    assert.isNotNull(response.body().data.suspendedAt)
  })

  test('rejects a comment longer than the permitted maximum', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/suspend`)
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
    assert.isNull(truck.suspendedAt)
  })

  test('refuses an unknown truck', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/trucks/00000000-0000-4000-8000-000000000000/suspend')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRUCK_NOT_FOUND')
  })

  test('refuses a truck that is already suspended', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ suspensionComment: 'Original reason' })
      .create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/suspend`)
      .loginAs(admin)
      .json({ comment: 'Overwriting reason' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_ALREADY_SUSPENDED')
    await truck.refresh()
    assert.equal(truck.suspensionComment, 'Original reason')
  })

  test('refuses an archived truck', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/suspend`).loginAs(admin).json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_ARCHIVED_CANNOT_SUSPEND')
    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
  })

  test('suspends a truck reserved by a planned discharge without releasing it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))
    const { truck, assignment } = await createReservedTruckScenario({ status: 'PLANNED' })
    const snapshotBefore = assignment.registrationSnapshot

    const response = await client
      .post(`/api/v1/trucks/${truck.id}/suspend`)
      .loginAs(admin)
      .json({ comment: 'Broke down on site' })

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'SUSPENDED')
    await assignment.refresh()
    assert.isNull(assignment.releasedAt)
    assert.equal(assignment.truckId, truck.id)
    assert.equal(assignment.registrationSnapshot, snapshotBefore)
  })

  test('suspends a truck assigned to an active shift without releasing it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))
    const { truck, shiftTruck } = await createReservedAndShiftedTruckScenario()

    const response = await client.post(`/api/v1/trucks/${truck.id}/suspend`).loginAs(admin).json({})

    response.assertStatus(200)
    await shiftTruck.refresh()
    assert.equal(shiftTruck.truckId, truck.id)
    assert.isNull(shiftTruck.effectiveTo)
  })

  test('leaves the lifecycle state and context untouched when suspension is refused', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived')
      .merge({ archiveComment: 'Retired from the fleet' })
      .create()
    // Read back through the database first, so the comparison is between two round-tripped rows
    // and cannot fail on the driver's timestamp precision rather than on a real change.
    await truck.refresh()
    const before = {
      status: truck.status,
      archivedAt: truck.archivedAt?.toISO() ?? null,
      archiveComment: truck.archiveComment,
      reactivatedAt: truck.reactivatedAt?.toISO() ?? null,
      reactivationComment: truck.reactivationComment,
      suspendedAt: truck.suspendedAt?.toISO() ?? null,
      suspensionComment: truck.suspensionComment,
      registration: truck.registration,
      transportCompanyId: truck.transportCompanyId,
    }

    await client.post(`/api/v1/trucks/${truck.id}/suspend`).loginAs(admin).json({})

    await truck.refresh()
    assert.deepEqual(
      {
        status: truck.status,
        archivedAt: truck.archivedAt?.toISO() ?? null,
        archiveComment: truck.archiveComment,
        reactivatedAt: truck.reactivatedAt?.toISO() ?? null,
        reactivationComment: truck.reactivationComment,
        suspendedAt: truck.suspendedAt?.toISO() ?? null,
        suspensionComment: truck.suspensionComment,
        registration: truck.registration,
        transportCompanyId: truck.transportCompanyId,
      },
      before,
    )
  })
})
