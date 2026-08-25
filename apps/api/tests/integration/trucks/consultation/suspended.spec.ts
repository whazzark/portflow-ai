import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import Truck from '#models/truck'
import { USER_ROLES } from '#models/user'

test.group('Suspended truck consultation HTTP contracts', (group) => {
  group.each.setup(async () => {
    await Truck.query().delete()
  })

  test('allows every active role to retrieve only suspended trucks', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    await TruckFactory.merge({
      registration: 'AVAILABLE-001',
      transportCompanyId: company.id,
    }).create()
    await TruckFactory.apply('archived')
      .merge({ registration: 'ARCHIVED-001', transportCompanyId: company.id })
      .create()
    await TruckFactory.apply('suspended')
      .merge({ registration: 'SUSPENDED-001', transportCompanyId: company.id })
      .create()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const response = await client.get('/api/v1/trucks/suspended').loginAs(user)

      response.assertStatus(200)
      assert.deepEqual(
        response.body().data.map((truck: { registration: string }) => truck.registration),
        ['SUSPENDED-001'],
      )
    }
  })

  test('refuses an unauthenticated caller', async ({ assert, client }) => {
    const response = await client.get('/api/v1/trucks/suspended')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('withholds the responsible administrator while keeping the suspension date and comment', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    await TruckFactory.apply('suspended')
      .merge({
        registration: 'SUSPENDED-002',
        transportCompanyId: company.id,
        suspendedAt: DateTime.fromISO('2026-08-20T07:30:00.000Z'),
        suspendedByUserId: administrator.id,
        suspensionComment: 'Gearbox failure, awaiting workshop slot',
      })
      .create()

    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client.get('/api/v1/trucks/suspended').loginAs(observer)

    response.assertStatus(200)
    const [truck] = response.body().data
    assert.equal(truck.suspensionComment, 'Gearbox failure, awaiting workshop slot')
    assert.isNotNull(truck.suspendedAt)
    // FR-015 keeps the responsible administrator in the administration collections.
    assert.notProperty(truck, 'suspendedBy')
    assert.notProperty(truck, 'suspendedByUserId')
    assert.notProperty(truck, 'archivedBy')
    assert.notProperty(truck, 'reactivatedBy')
    assert.notProperty(truck, 'returnedToServiceBy')
    // biome-ignore lint/security/noSecrets: DTO identifier field, not a secret
    assert.notProperty(truck, 'returnedToServiceByUserId')
  })

  test('carries an earlier return to service without naming who performed it', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    // Suspended again after an earlier cycle: the previous return stays readable beside it.
    await TruckFactory.apply('suspended')
      .merge({
        registration: 'SUSPENDED-004',
        transportCompanyId: company.id,
        returnedToServiceAt: DateTime.fromISO('2026-07-02T09:00:00.000Z'),
        returnedToServiceByUserId: administrator.id,
        returnToServiceComment: 'Brakes replaced after the previous immobilisation',
      })
      .create()

    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client.get('/api/v1/trucks/suspended').loginAs(observer)

    response.assertStatus(200)
    const [truck] = response.body().data
    assert.equal(truck.returnToServiceComment, 'Brakes replaced after the previous immobilisation')
    assert.isNotNull(truck.returnedToServiceAt)
    assert.notProperty(truck, 'returnedToServiceBy')
    // biome-ignore lint/security/noSecrets: DTO identifier field, not a secret
    assert.notProperty(truck, 'returnedToServiceByUserId')
  })

  test('keeps the complete collection carrying the responsible administrator', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const administrator = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    await TruckFactory.apply('suspended')
      .merge({
        registration: 'SUSPENDED-003',
        transportCompanyId: company.id,
        suspendedByUserId: administrator.id,
      })
      .create()

    const response = await client.get('/api/v1/trucks').loginAs(administrator)

    response.assertStatus(200)
    const [truck] = response.body().data
    assert.equal(truck.suspendedBy.id, administrator.id)
  })
})
