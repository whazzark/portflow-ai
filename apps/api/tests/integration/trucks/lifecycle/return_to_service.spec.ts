import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import Truck from '#models/truck'

import {
  createReservedAndShiftedTruckScenario,
  createSuspendedTruckWithArchivedCompanyScenario,
} from '../../../support/trucks/lifecycle_fixtures.ts'

test.group('POST /api/v1/trucks/:id/return-to-service', () => {
  test('returns a suspended truck to service with lifecycle metadata and a populated returnedToServiceBy', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const suspendingAdmin = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({
        suspendedAt: DateTime.fromISO('2026-08-20T07:02:00.000+02:00'),
        suspendedByUserId: suspendingAdmin.id,
        suspensionComment: 'Gearbox failure, awaiting workshop slot',
      })
      .create()
    await truck.refresh()

    const response = await client
      .post(`/api/v1/trucks/${truck.id}/return-to-service`)
      .loginAs(admin)
      .json({ comment: '  Gearbox replaced, roadworthy  ' })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.status, 'AVAILABLE')
    assert.equal(data.returnToServiceComment, 'Gearbox replaced, roadworthy')
    assert.equal(data.returnedToServiceByUserId, admin.id)
    assert.isNotNull(data.returnedToServiceAt)
    assert.equal(data.returnedToServiceBy.id, admin.id)
    assert.equal(data.registration, truck.registration)
    assert.equal(data.transportCompanyId, truck.transportCompanyId)
    // The suspension it ended stays in the payload — FR-013, not a leftover.
    assert.equal(data.suspendedAt, truck.suspendedAt?.toISO())
    assert.equal(data.suspensionComment, 'Gearbox failure, awaiting workshop slot')
    assert.equal(data.suspendedBy.id, suspendingAdmin.id)
  })

  test('returns a truck to service without a comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const truck = await TruckFactory.apply('suspended').create()

    const response = await client
      .post(`/api/v1/trucks/${truck.id}/return-to-service`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.isNull(response.body().data.returnToServiceComment)
    assert.isNotNull(response.body().data.returnedToServiceAt)
  })

  test('moves the truck out of the suspended collection and back into available consultation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('suspended').create()
    await client.post(`/api/v1/trucks/${truck.id}/return-to-service`).loginAs(admin).json({})

    const suspended = await client.get('/api/v1/trucks/suspended').loginAs(admin)
    assert.isFalse(
      (suspended.body().data as Array<{ id: string }>).some((item) => item.id === truck.id),
    )

    const available = await client.get('/api/v1/trucks/available').loginAs(admin)
    assert.isTrue(
      (available.body().data as Array<{ id: string }>).some((item) => item.id === truck.id),
    )

    const complete = await client.get('/api/v1/trucks').loginAs(admin)
    const listed = (complete.body().data as Array<{ id: string; status: string }>).find(
      (item) => item.id === truck.id,
    )
    assert.equal(listed?.status, 'AVAILABLE')
  })

  // --- User Story 2: the assignments the truck kept while suspended ---

  test('returns a truck that kept a planned discharge and an active shift assignment, leaving both unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck, assignment, shiftTruck } = await createReservedAndShiftedTruckScenario()
    await Truck.query()
      .where('id', truck.id)
      .update({ status: 'SUSPENDED', suspendedAt: DateTime.now().toSQL({ includeOffset: false }) })
    await assignment.refresh()
    await shiftTruck.refresh()
    const assignmentBefore = assignment.toJSON()
    const shiftTruckBefore = shiftTruck.toJSON()

    const response = await client
      .post(`/api/v1/trucks/${truck.id}/return-to-service`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'AVAILABLE')
    await assignment.refresh()
    await shiftTruck.refresh()
    assert.deepEqual(assignment.toJSON(), assignmentBefore)
    assert.deepEqual(shiftTruck.toJSON(), shiftTruckBefore)
  })

  // --- User Story 3: authorization and lifecycle consistency ---

  test('rejects an unauthenticated return', async ({ assert, client }) => {
    const truck = await TruckFactory.apply('suspended').create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/return-to-service`).json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    await truck.refresh()
    assert.equal(truck.status, 'SUSPENDED')
  })

  test('rejects a return for non-admin active roles', async ({ assert, client }) => {
    for (const role of ['OBSERVER', 'OPERATIONS_LEAD'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const truck = await TruckFactory.apply('suspended').create()
      const response = await client
        .post(`/api/v1/trucks/${truck.id}/return-to-service`)
        .loginAs(user)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await truck.refresh()
      assert.equal(truck.status, 'SUSPENDED')
    }
  })

  test('rejects a return for an unknown truck', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/trucks/00000000-0000-4000-8000-000000000000/return-to-service')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRUCK_NOT_FOUND')
  })

  test('reports each refusal family with its own code', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const available = await TruckFactory.create()
    const alreadyAvailable = await client
      .post(`/api/v1/trucks/${available.id}/return-to-service`)
      .loginAs(admin)
      .json({})
    alreadyAvailable.assertStatus(409)
    assert.equal(alreadyAvailable.body().error.code, 'E_TRUCK_ALREADY_AVAILABLE')

    const archived = await TruckFactory.apply('archived').create()
    const archivedResponse = await client
      .post(`/api/v1/trucks/${archived.id}/return-to-service`)
      .loginAs(admin)
      .json({})
    archivedResponse.assertStatus(409)
    assert.equal(archivedResponse.body().error.code, 'E_TRUCK_ARCHIVED_CANNOT_RETURN')

    const { truck: blockedByCompany } = await createSuspendedTruckWithArchivedCompanyScenario()
    const companyResponse = await client
      .post(`/api/v1/trucks/${blockedByCompany.id}/return-to-service`)
      .loginAs(admin)
      .json({})
    companyResponse.assertStatus(409)
    assert.equal(companyResponse.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_ARCHIVED')
    // The refusal names the one action that actually unblocks it; reassignment is impossible for a
    // suspended truck, since updates require an available one.
    assert.include(companyResponse.body().error.message, 'reactivate the transport company')
    assert.notInclude(companyResponse.body().error.message, 'reassign')
  })

  test('rejects a return comment longer than the permitted maximum', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('suspended').create()

    const response = await client
      .post(`/api/v1/trucks/${truck.id}/return-to-service`)
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await truck.refresh()
    assert.equal(truck.status, 'SUSPENDED')
    assert.isNull(truck.returnedToServiceAt)
  })

  test('leaves a returned truck open to every action an available truck accepts', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    for (const action of ['suspend', 'archive'] as const) {
      const truck = await TruckFactory.apply('suspended').create()
      await client.post(`/api/v1/trucks/${truck.id}/return-to-service`).loginAs(admin).json({})

      const response = await client
        .post(`/api/v1/trucks/${truck.id}/${action}`)
        .loginAs(admin)
        .json({})

      response.assertStatus(200)
      assert.equal(response.body().data.status, action === 'suspend' ? 'SUSPENDED' : 'ARCHIVED')
    }

    const updatable = await TruckFactory.apply('suspended').create()
    await updatable.refresh()
    await client.post(`/api/v1/trucks/${updatable.id}/return-to-service`).loginAs(admin).json({})

    const updated = await client.patch(`/api/v1/trucks/${updatable.id}`).loginAs(admin).json({
      registration: updatable.registration,
      vehicleModel: 'Corrected model',
      capacityTonnes: 27.5,
      transportCompanyId: updatable.transportCompanyId,
    })

    updated.assertStatus(200)
    assert.equal(updated.body().data.vehicleModel, 'Corrected model')
  })
})
