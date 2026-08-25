import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createArchivedTruckWithArchivedCompanyScenario } from '../../../support/trucks/lifecycle_fixtures.ts'

test.group('POST /api/v1/trucks/:id/reactivate', () => {
  test('reactivates a truck with lifecycle metadata and a populated reactivatedBy', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    await truck.refresh()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: '  Back from the gearbox overhaul  ' })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.status, 'AVAILABLE')
    assert.equal(data.reactivationComment, 'Back from the gearbox overhaul')
    assert.equal(data.reactivatedByUserId, admin.id)
    assert.isNotNull(data.reactivatedAt)
    assert.equal(data.reactivatedBy.id, admin.id)
    assert.equal(data.registration, truck.registration)
    assert.equal(data.transportCompanyId, truck.transportCompanyId)
    assert.equal(data.archivedAt, truck.archivedAt?.toISO())
    assert.equal(data.archiveComment, truck.archiveComment)
  })

  test('reactivates a truck without a comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/reactivate`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.isNull(response.body().data.reactivationComment)
  })

  test('includes a reactivated truck in available consultation and keeps it in the complete list', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()
    await client.post(`/api/v1/trucks/${truck.id}/reactivate`).loginAs(admin).json({})

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

  test('rejects unauthenticated reactivation', async ({ assert, client }) => {
    const truck = await TruckFactory.apply('archived').create()
    const response = await client.post(`/api/v1/trucks/${truck.id}/reactivate`).json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects reactivation for non-admin active roles', async ({ assert, client }) => {
    for (const role of ['OBSERVER', 'OPERATIONS_LEAD'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const truck = await TruckFactory.apply('archived').create()
      const response = await client.post(`/api/v1/trucks/${truck.id}/reactivate`).loginAs(user)

      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
      await truck.refresh()
      assert.equal(truck.status, 'ARCHIVED')
    }
  })

  test('rejects reactivation of an unknown truck', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/trucks/00000000-0000-0000-0000-000000000000/reactivate')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRUCK_NOT_FOUND')
  })

  test('rejects reactivation of an already-available truck and leaves its context unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.create()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Trying again' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_ALREADY_AVAILABLE')
    await truck.refresh()
    assert.notEqual(truck.reactivationComment, 'Trying again')
  })

  test('rejects reactivation when the transport company is archived, leaving the truck archived', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { truck } = await createArchivedTruckWithArchivedCompanyScenario()
    const response = await client
      .post(`/api/v1/trucks/${truck.id}/reactivate`)
      .loginAs(admin)
      .json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRUCK_TRANSPORT_COMPANY_ARCHIVED')
    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
    assert.isNull(truck.reactivatedAt)
  })

  test('collapses two near-simultaneous reactivation attempts into exactly one reactivation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const truck = await TruckFactory.apply('archived').create()

    const [first, second] = await Promise.all([
      client
        .post(`/api/v1/trucks/${truck.id}/reactivate`)
        .loginAs(admin)
        .json({ comment: 'first' }),
      client
        .post(`/api/v1/trucks/${truck.id}/reactivate`)
        .loginAs(admin)
        .json({ comment: 'second' }),
    ])

    const statuses = [first.status(), second.status()].sort()
    assert.deepEqual(statuses, [200, 409])

    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
    const winner = first.status() === 200 ? first : second
    assert.equal(truck.reactivationComment, winner.body().data.reactivationComment)
  })

  test('never leaves an available truck under an archived transport company when reactivation races company archival', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const company = await TransportCompanyFactory.create()
      const truck = await TruckFactory.apply('archived')
        .merge({ transportCompanyId: company.id })
        .create()

      const [reactivateResponse, archiveCompanyResponse] = await Promise.all([
        client.post(`/api/v1/trucks/${truck.id}/reactivate`).loginAs(admin).json({}),
        client.post(`/api/v1/transport-companies/${company.id}/archive`).loginAs(admin).json({}),
      ])

      const outcomes = [reactivateResponse.status(), archiveCompanyResponse.status()].sort()
      assert.deepEqual(outcomes, [200, 409])

      await truck.refresh()
      await company.refresh()

      // The invariant this gate protects: no available truck may be provided by an archived
      // transport company, in either order of arrival.
      assert.isFalse(truck.status === 'AVAILABLE' && company.status === 'ARCHIVED')
    }
  })
})
