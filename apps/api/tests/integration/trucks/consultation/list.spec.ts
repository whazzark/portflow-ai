import { test } from '@japa/runner'
import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import Truck from '#models/truck'
import { USER_ROLES } from '#models/user'

test.group('Truck consultation HTTP contracts', (group) => {
  group.each.setup(async () => {
    await Truck.query().delete()
  })

  test('protects the complete collection and allows both administrator roles', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const operationsLead = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    const organizationAdmin = await UserFactory.apply('active')
      .merge({ role: 'ORGANIZATION_ADMIN' })
      .create()
    const operationsAdmin = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()

    const unauthenticated = await client.get('/api/v1/trucks')
    const observerResponse = await client.get('/api/v1/trucks').loginAs(observer)
    const leadResponse = await client.get('/api/v1/trucks').loginAs(operationsLead)

    unauthenticated.assertStatus(401)
    observerResponse.assertStatus(403)
    leadResponse.assertStatus(403)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal(observerResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
    assert.equal(leadResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')

    for (const admin of [organizationAdmin, operationsAdmin]) {
      const response = await client.get('/api/v1/trucks').loginAs(admin)
      response.assertStatus(200)
      assert.deepEqual(response.body(), { data: [] })
    }
  })

  test('allows every active role to retrieve only available trucks', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const available = await TruckFactory.merge({
      registration: 'AVAILABLE-001',
      transportCompanyId: company.id,
    }).create()
    const archived = await TruckFactory.apply('archived')
      .merge({ registration: 'ARCHIVED-001', transportCompanyId: company.id })
      .create()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const response = await client.get('/api/v1/trucks/available').loginAs(user)

      response.assertStatus(200)
      assert.include(
        response.body().data.map((truck: { id: string }) => truck.id),
        available.id,
      )
      assert.notInclude(
        response.body().data.map((truck: { id: string }) => truck.id),
        archived.id,
      )
      assert.isTrue(
        response.body().data.every((truck: { status: string }) => truck.status === 'AVAILABLE'),
      )
    }
  })

  test('withholds the responsible administrator from the available collection', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    // Back in service after a suspension: the cycle stays readable, its actors do not.
    await TruckFactory.merge({
      registration: 'RETURNED-001',
      transportCompanyId: company.id,
      suspendedAt: DateTime.fromISO('2026-07-02T09:00:00.000Z'),
      suspendedByUserId: administrator.id,
      suspensionComment: 'Gearbox failure, awaiting workshop slot',
      returnedToServiceAt: DateTime.fromISO('2026-07-20T09:00:00.000Z'),
      returnedToServiceByUserId: administrator.id,
      returnToServiceComment: 'Gearbox replaced',
    }).create()

    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client.get('/api/v1/trucks/available').loginAs(observer)

    response.assertStatus(200)
    const [truck] = response.body().data
    assert.equal(truck.returnToServiceComment, 'Gearbox replaced')
    assert.isNotNull(truck.returnedToServiceAt)
    assert.equal(truck.suspensionComment, 'Gearbox failure, awaiting workshop slot')
    // FR-015 keeps the responsible administrator in the administration collections.
    assert.notProperty(truck, 'returnedToServiceBy')
    // biome-ignore lint/security/noSecrets: DTO identifier field, not a secret
    assert.notProperty(truck, 'returnedToServiceByUserId')
    assert.notProperty(truck, 'suspendedBy')
    assert.notProperty(truck, 'suspendedByUserId')
    assert.notProperty(truck, 'archivedBy')
    assert.notProperty(truck, 'reactivatedBy')
  })

  test('rejects unauthenticated and non-active access without exposing data', async ({
    assert,
    client,
  }) => {
    const deactivated = await UserFactory.apply('deactivated').create()
    const company = await TransportCompanyFactory.create()
    await TruckFactory.merge({ transportCompanyId: company.id }).create()

    for (const path of ['/api/v1/trucks', '/api/v1/trucks/available']) {
      const unauthenticated = await client.get(path)
      const inactive = await client.get(path).loginAs(deactivated)

      unauthenticated.assertStatus(401)
      inactive.assertStatus(401)
      assert.isUndefined(unauthenticated.body().data)
      assert.isUndefined(inactive.body().data)
    }
  })

  test('returns the exact nested DTO in case-folded registration order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived')
      .merge({ name: 'Atlantic Transport' })
      .create()
    const archivedAt = DateTime.fromISO('2026-07-20T14:32:11.000Z')
    const archived = await TruckFactory.apply('archived')
      .merge({
        registration: 'alpha-100',
        vehicleModel: 'Volvo FMX',
        capacityTonnes: new Decimal('32.5'),
        transportCompanyId: company.id,
        archivedAt,
        archivedByUserId: actor.id,
        archiveComment: 'Vehicle retired from the fleet',
      })
      .create()
    await TruckFactory.merge({
      registration: 'Beta-200',
      transportCompanyId: company.id,
    }).create()

    const response = await client.get('/api/v1/trucks').loginAs(admin)

    response.assertStatus(200)
    const trucks = response.body().data as Array<Record<string, unknown>>
    assert.deepEqual(
      trucks.map((truck) => truck.registration),
      ['alpha-100', 'Beta-200'],
    )
    const serialized = trucks.find((truck) => truck.id === archived.id)
    assert.deepEqual(Object.keys(serialized ?? {}).sort(), [
      'archiveComment',
      'archivedAt',
      'archivedBy',
      // biome-ignore lint/security/noSecrets: public DTO identifier field
      'archivedByUserId',
      'capacityTonnes',
      'createdAt',
      'id',
      'reactivatedAt',
      'reactivatedBy',
      'reactivatedByUserId',
      'reactivationComment',
      'registration',
      'returnToServiceComment',
      'returnedToServiceAt',
      'returnedToServiceBy',
      // biome-ignore lint/security/noSecrets: public DTO identifier field
      'returnedToServiceByUserId',
      'status',
      'suspendedAt',
      'suspendedBy',
      'suspendedByUserId',
      'suspensionComment',
      'transportCompanyId',
      'updatedAt',
      'vehicleModel',
    ])
    assert.deepInclude(serialized, {
      archivedBy: { id: actor.id, firstName: actor.firstName, lastName: actor.lastName },
      capacityTonnes: 32.5,
      transportCompanyId: company.id,
    })
    assert.typeOf(serialized?.capacityTonnes, 'number')
  })

  test('returns empty collections and reflects authoritative changes on refresh', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const original = await TransportCompanyFactory.merge({ name: 'Original Company' }).create()
    const replacement = await TransportCompanyFactory.merge({
      name: 'Replacement Company',
    }).create()
    const empty = await client.get('/api/v1/trucks').loginAs(admin)

    empty.assertStatus(200)
    assert.deepEqual(empty.body(), { data: [] })

    const truck = await TruckFactory.merge({
      registration: 'REFRESH-HTTP',
      transportCompanyId: original.id,
    }).create()
    truck.transportCompanyId = replacement.id
    truck.status = 'ARCHIVED'
    truck.archivedAt = DateTime.now()
    await truck.save()

    const refreshed = await client.get('/api/v1/trucks').loginAs(admin)
    const serialized = refreshed.body().data.find((item: { id: string }) => item.id === truck.id)

    assert.equal(serialized.status, 'ARCHIVED')
    assert.equal(serialized.transportCompanyId, replacement.id)
  })

  test('does not expose an item-detail route', async ({ client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()

    const response = await client.get(`/api/v1/trucks/${truck.id}`).loginAs(admin)

    response.assertStatus(404)
  })

  test('excludes suspended trucks from the available collection for every role', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const suspended = await TruckFactory.apply('suspended')
      .merge({ registration: 'SUSPENDED-100', transportCompanyId: company.id })
      .create()
    await TruckFactory.merge({
      registration: 'AVAILABLE-100',
      transportCompanyId: company.id,
    }).create()

    for (const role of [
      'ORGANIZATION_ADMIN',
      'OPERATIONS_ADMIN',
      'OPERATIONS_LEAD',
      'OBSERVER',
    ] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const response = await client.get('/api/v1/trucks/available').loginAs(user)

      response.assertStatus(200)
      const registrations = (response.body().data as Array<Record<string, unknown>>).map(
        (truck) => truck.registration,
      )
      assert.notInclude(registrations, 'SUSPENDED-100')
      assert.include(registrations, 'AVAILABLE-100')
    }

    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const all = await client.get('/api/v1/trucks').loginAs(admin)

    all.assertStatus(200)
    const listed = (all.body().data as Array<Record<string, unknown>>).find(
      (truck) => truck.id === suspended.id,
    )
    assert.equal(listed?.status, 'SUSPENDED')
    assert.isNotNull(listed?.suspendedAt)
  })
})
