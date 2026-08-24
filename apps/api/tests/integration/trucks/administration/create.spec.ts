import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'

test.group('POST /api/v1/trucks', () => {
  test('rejects unauthenticated creation', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()

    const response = await client.post('/api/v1/trucks').json({
      registration: 'AA-000-AA',
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects creation for non-admin users', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.post('/api/v1/trucks').loginAs(observer).json({
      registration: 'AA-000-AA',
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('creates a truck and exposes it immediately in consultation', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const response = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: '  AB-123-CD ',
      vehicleModel: 'Volvo FMX',
      capacityTonnes: 32.5,
      transportCompanyId: company.id,
    })

    response.assertStatus(201)
    assert.equal(response.body().data.registration, 'AB-123-CD')
    assert.equal(response.body().data.vehicleModel, 'Volvo FMX')
    assert.equal(response.body().data.capacityTonnes, 32.5)
    assert.equal(response.body().data.transportCompanyId, company.id)
    assert.equal(response.body().data.status, 'AVAILABLE')
    assert.isNull(response.body().data.archivedAt)

    const index = await client.get('/api/v1/trucks').loginAs(admin)
    const available = await client.get('/api/v1/trucks/available').loginAs(admin)

    assert.isTrue(
      index.body().data.some((truck: { id: string }) => truck.id === response.body().data.id),
    )
    assert.isTrue(
      available.body().data.some((truck: { id: string }) => truck.id === response.body().data.id),
    )
  })

  test('creates a truck without a vehicle model when it is omitted', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()

    const response = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'NO-MODEL-01',
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })

    response.assertStatus(201)
    assert.isNull(response.body().data.vehicleModel)
  })

  test('rejects missing or blank required fields', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const missingRegistration = await client
      .post('/api/v1/trucks')
      .loginAs(admin)
      .json({ capacityTonnes: 10, transportCompanyId: company.id })
    const blankRegistration = await client
      .post('/api/v1/trucks')
      .loginAs(admin)
      .json({ registration: '   ', capacityTonnes: 10, transportCompanyId: company.id })
    const missingCapacity = await client
      .post('/api/v1/trucks')
      .loginAs(admin)
      .json({ registration: 'MISSING-CAP-01', transportCompanyId: company.id })
    const missingCompany = await client
      .post('/api/v1/trucks')
      .loginAs(admin)
      .json({ registration: 'MISSING-CO-02', capacityTonnes: 10 })

    missingRegistration.assertStatus(422)
    blankRegistration.assertStatus(422)
    missingCapacity.assertStatus(422)
    missingCompany.assertStatus(422)
    assert.equal(missingRegistration.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects a non-positive or overly precise capacity', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const zero = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'ZERO-CAP-01',
      capacityTonnes: 0,
      transportCompanyId: company.id,
    })
    const negative = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'NEG-CAP-01',
      capacityTonnes: -5,
      transportCompanyId: company.id,
    })
    const imprecise = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'IMPRECISE-CAP-01',
      capacityTonnes: 12.3456,
      transportCompanyId: company.id,
    })

    zero.assertStatus(422)
    negative.assertStatus(422)
    imprecise.assertStatus(422)
    assert.equal(zero.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects an archived or missing transport company', async ({ assert, client }) => {
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const archived = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'ARCHIVED-CO-02',
      capacityTonnes: 10,
      transportCompanyId: archivedCompany.id,
    })
    const missing = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: 'MISSING-CO-03',
      capacityTonnes: 10,
      transportCompanyId: '00000000-0000-4000-8000-000000000000',
    })

    archived.assertStatus(422)
    missing.assertStatus(422)
    assert.equal(archived.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_INVALID')
    assert.equal(missing.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_INVALID')
  })

  test('rejects a case/whitespace duplicate registration', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    await TruckFactory.merge({
      registration: 'DUPLICATE-01',
      transportCompanyId: company.id,
    }).create()

    const response = await client.post('/api/v1/trucks').loginAs(admin).json({
      registration: ' duplicate-01 ',
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_REGISTRATION_CONFLICT')
  })

  test('allows exactly one truck to be created when two submissions race on the same registration', async ({
    assert,
    client,
  }) => {
    const company = await TransportCompanyFactory.create()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const [first, second] = await Promise.all([
      client.post('/api/v1/trucks').loginAs(admin).json({
        registration: 'RACE-001',
        capacityTonnes: 10,
        transportCompanyId: company.id,
      }),
      client.post('/api/v1/trucks').loginAs(admin).json({
        registration: 'race-001',
        capacityTonnes: 12,
        transportCompanyId: company.id,
      }),
    ])

    const statuses = [first.status(), second.status()].sort()
    assert.deepEqual(statuses, [201, 409])

    const listResponse = await client.get('/api/v1/trucks').loginAs(admin)
    const matches = listResponse
      .body()
      .data.filter(
        (truck: { registration: string }) => truck.registration.toLowerCase() === 'race-001',
      )
    assert.lengthOf(matches, 1)
  })
})
