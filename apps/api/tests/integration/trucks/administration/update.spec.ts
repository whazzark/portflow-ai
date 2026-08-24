import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'
import { createPersistedTruckUsageScenario } from '../../../support/persisted_truck_usage.js'

// Discharge truck assignments restrict truck deletion by foreign key, so any committed-truck
// scenario built by createPersistedTruckUsageScenario must be cleared before trucks are. The
// discharges themselves are left in place: other suites' unrelated discharges may already carry
// shifts or product lots that would make a blanket discharge delete fail here too.
async function deleteTrucksAndTheirAssignments() {
  await DischargeTruckAssignment.query().whereIn('truckId', Truck.query().select('id')).delete()
  await Truck.query().delete()
}

test.group('PATCH /api/v1/trucks/:id', (group) => {
  group.each.setup(deleteTrucksAndTheirAssignments)
  group.each.teardown(deleteTrucksAndTheirAssignments)

  test('updates a truck and exposes it immediately in consultation, for both admin roles', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const orgAdmin = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const opsAdmin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    for (const admin of [orgAdmin, opsAdmin]) {
      const truck = await TruckFactory.merge({
        transportCompanyId: company.id,
        registration: `ORIGINAL-${admin.id.slice(0, 8)}`,
      }).create()

      const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
        registration: '  UPDATED-CD ',
        vehicleModel: 'Volvo FH16',
        capacityTonnes: 38.5,
        transportCompanyId: company.id,
      })

      response.assertStatus(200)
      assert.equal(response.body().data.id, truck.id)
      assert.equal(response.body().data.registration, 'UPDATED-CD')
      assert.equal(response.body().data.vehicleModel, 'Volvo FH16')
      assert.equal(response.body().data.capacityTonnes, 38.5)
      assert.equal(response.body().data.transportCompanyId, company.id)
      assert.equal(response.body().data.status, 'AVAILABLE')
      assert.isNull(response.body().data.archivedAt)

      const index = await client.get('/api/v1/trucks').loginAs(admin)
      const available = await client.get('/api/v1/trucks/available').loginAs(admin)

      assert.isTrue(index.body().data.some((row: { id: string }) => row.id === truck.id))
      assert.isTrue(
        available
          .body()
          .data.some(
            (row: { id: string; registration: string }) =>
              row.id === truck.id && row.registration === 'UPDATED-CD',
          ),
      )

      await Truck.query().where('id', truck.id).delete()
    }
  })

  test('clears the vehicle model when null is submitted, and requires the key to be present', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.merge({
      transportCompanyId: company.id,
      vehicleModel: 'Renault Kerax',
    }).create()

    const cleared = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: null,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    cleared.assertStatus(200)
    assert.isNull(cleared.body().data.vehicleModel)

    const omitted = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    omitted.assertStatus(422)
    assert.equal(omitted.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('accepts resubmitting all four current values as a no-op success', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const truck = await TruckFactory.merge({
      transportCompanyId: company.id,
      registration: 'NO-OP-02',
      vehicleModel: 'Scania R450',
    }).create()

    const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    response.assertStatus(200)
    assert.equal(response.body().data.registration, 'NO-OP-02')
    assert.equal(response.body().data.vehicleModel, 'Scania R450')
  })

  test('refuses a provider change while the truck is committed to a planned or active discharge', async ({
    assert,
    client,
  }) => {
    const newCompany = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    for (const status of ['PLANNED', 'ACTIVE'] as const) {
      const { truck } = await createPersistedTruckUsageScenario({ status })

      const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
        registration: truck.registration,
        vehicleModel: truck.vehicleModel,
        capacityTonnes: truck.capacityTonnes.toNumber(),
        transportCompanyId: newCompany.id,
      })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_LOCKED')

      const reloaded = await Truck.findOrFail(truck.id)
      assert.equal(reloaded.transportCompanyId, truck.transportCompanyId)
      assert.equal(reloaded.registration, truck.registration)
    }
  })

  test('allows changing only the registration, vehicle model, or capacity of a committed truck', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck } = await createPersistedTruckUsageScenario({ status: 'ACTIVE' })

    const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: 'COMMITTED-OK-01',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: truck.transportCompanyId,
    })

    response.assertStatus(200)
    assert.equal(response.body().data.registration, 'COMMITTED-OK-01')
  })

  test('rejects an archived or missing transport company when reassigning', async ({
    assert,
    client,
  }) => {
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()

    const archived = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: archivedCompany.id,
    })
    const missing = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: '00000000-0000-4000-8000-000000000000',
    })

    archived.assertStatus(422)
    missing.assertStatus(422)
    assert.equal(archived.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_INVALID')
    assert.equal(missing.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_INVALID')
  })

  test('reports the discharge commitment even when the submitted company is also archived', async ({
    assert,
    client,
  }) => {
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck } = await createPersistedTruckUsageScenario({ status: 'ACTIVE' })

    const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: archivedCompany.id,
    })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_LOCKED')
  })

  test('rejects unauthenticated and unauthorized updates', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const payload = {
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    }

    const unauthenticated = await client.patch(`/api/v1/trucks/${truck.id}`).json(payload)
    const asObserver = await client
      .patch(`/api/v1/trucks/${truck.id}`)
      .loginAs(observer)
      .json(payload)
    const asLead = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(lead).json(payload)

    unauthenticated.assertStatus(401)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    asObserver.assertStatus(403)
    assert.equal(asObserver.body().error.code, 'E_AUTHORIZATION_FAILURE')
    asLead.assertStatus(403)
    assert.equal(asLead.body().error.code, 'E_AUTHORIZATION_FAILURE')

    const reloaded = await Truck.findOrFail(truck.id)
    assert.equal(reloaded.registration, truck.registration)
  })

  test('rejects missing or blank required fields, and an invalid capacity', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()

    const blankRegistration = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: '   ',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })
    // A whitespace-only vehicleModel cannot be exercised as blank over real HTTP: the JSON
    // bodyparser's default trimWhitespaces + convertEmptyStringsToNull turns it into an explicit
    // null before validation runs, which is the same as clearing the model (FR-006). The blank
    // rejection itself is proven at the use-case level in tests/unit/trucks/administration/update.spec.ts.
    const overLongVehicleModel = await client
      .patch(`/api/v1/trucks/${truck.id}`)
      .loginAs(admin)
      .json({
        registration: truck.registration,
        vehicleModel: 'x'.repeat(256),
        capacityTonnes: truck.capacityTonnes.toNumber(),
        transportCompanyId: company.id,
      })
    const zeroCapacity = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: 0,
      transportCompanyId: company.id,
    })
    const imprecise = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: 12.3456,
      transportCompanyId: company.id,
    })
    const invalidCompanyId = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: 'not-a-uuid',
    })

    blankRegistration.assertStatus(422)
    overLongVehicleModel.assertStatus(422)
    zeroCapacity.assertStatus(422)
    imprecise.assertStatus(422)
    invalidCompanyId.assertStatus(422)
    assert.equal(blankRegistration.body().error.code, 'E_VALIDATION_ERROR')

    const reloaded = await Truck.findOrFail(truck.id)
    assert.equal(reloaded.registration, truck.registration)
  })

  test('rejects a case/whitespace duplicate registration', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    await TruckFactory.merge({
      registration: 'DUP-UPD-INT-01',
      transportCompanyId: company.id,
    }).create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()

    const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: ' dup-upd-int-01 ',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_REGISTRATION_CONFLICT')
  })

  test('rejects updating an archived truck as read-only', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archived = await TruckFactory.apply('archived').create()

    const response = await client.patch(`/api/v1/trucks/${archived.id}`).loginAs(admin).json({
      registration: 'ARCHIVED-UPD-INT-01',
      vehicleModel: archived.vehicleModel,
      capacityTonnes: archived.capacityTonnes.toNumber(),
      transportCompanyId: archived.transportCompanyId,
    })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_ARCHIVED')
  })

  test('rejects updating a truck that does not exist', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const response = await client
      .patch('/api/v1/trucks/00000000-0000-4000-8000-000000000000')
      .loginAs(admin)
      .json({
        registration: 'GHOST-INT-01',
        vehicleModel: null,
        capacityTonnes: 10,
        transportCompanyId: company.id,
      })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRUCK_NOT_FOUND')
  })

  test('leaves existing discharge truck assignments and the previous transport company untouched after a reassignment', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck, assignment } = await createPersistedTruckUsageScenario({ status: 'CLOSED' })
    const originalCompany = await TransportCompany.find(truck.transportCompanyId)
    const newCompany = await TransportCompanyFactory.create()
    const originalRegistration = truck.registration
    const originalCompanyId = truck.transportCompanyId
    const assignmentSnapshot = {
      registrationSnapshot: assignment.registrationSnapshot,
      transportCompanyId: assignment.transportCompanyId,
      transportCompanyNameSnapshot: assignment.transportCompanyNameSnapshot,
    }

    const response = await client.patch(`/api/v1/trucks/${truck.id}`).loginAs(admin).json({
      registration: 'REASSIGNED-SNAPSHOT-01',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: newCompany.id,
    })

    response.assertStatus(200)
    assert.equal(response.body().data.transportCompanyId, newCompany.id)

    const reloadedAssignment = await DischargeTruckAssignment.findOrFail(assignment.id)
    assert.equal(reloadedAssignment.registrationSnapshot, assignmentSnapshot.registrationSnapshot)
    assert.equal(reloadedAssignment.transportCompanyId, assignmentSnapshot.transportCompanyId)
    assert.equal(
      reloadedAssignment.transportCompanyNameSnapshot,
      assignmentSnapshot.transportCompanyNameSnapshot,
    )
    assert.notEqual(reloadedAssignment.registrationSnapshot, 'REASSIGNED-SNAPSHOT-01')
    assert.notEqual(reloadedAssignment.transportCompanyId, newCompany.id)

    const reloadedOriginalCompany = await TransportCompany.find(originalCompanyId)
    assert.equal(reloadedOriginalCompany?.name, originalCompany?.name)
    assert.equal(reloadedOriginalCompany?.status, originalCompany?.status)
    assert.notEqual(originalRegistration, 'REASSIGNED-SNAPSHOT-01')
  })
})
