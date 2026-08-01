import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'

test.group('Weighing areas administration', () => {
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

    const unauthenticated = await client.get('/api/v1/weighing-areas')
    const observerResponse = await client.get('/api/v1/weighing-areas').loginAs(observer)
    const operationsLeadResponse = await client
      .get('/api/v1/weighing-areas')
      .loginAs(operationsLead)

    unauthenticated.assertStatus(401)
    observerResponse.assertStatus(403)
    operationsLeadResponse.assertStatus(403)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal(observerResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')
    assert.equal(operationsLeadResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')

    for (const admin of [organizationAdmin, operationsAdmin]) {
      const response = await client.get('/api/v1/weighing-areas').loginAs(admin)
      response.assertStatus(200)
      assert.deepEqual(response.body(), { data: [] })
    }
  })

  test('lists complete available and archived records in deterministic name order', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const zulu = await WeighingAreaFactory.merge({ name: 'Zulu Scale' }).create()
    const alpha = await WeighingAreaFactory.apply('archived')
      .apply('boundaryCoordinates')
      .merge({ name: 'alpha Scale', archiveComment: 'Historic' })
      .create()
    const beta = await WeighingAreaFactory.merge({ name: 'Beta Scale' }).create()

    const response = await client.get('/api/v1/weighing-areas').loginAs(admin)

    response.assertStatus(200)
    const ids = new Set([zulu.id, alpha.id, beta.id])
    const areas = response.body().data.filter((area: { id: string }) => ids.has(area.id))
    assert.deepEqual(
      areas.map((area: { id: string }) => area.id),
      [alpha.id, beta.id, zulu.id],
    )
    assert.equal(areas[0].status, 'ARCHIVED')
    assert.equal(areas[0].latitude, -90)
    assert.equal(areas[0].longitude, 180)
    assert.isNull(areas[0].archivedByUserId)
    assert.isNull(areas[0].archiveComment)
    assert.equal(areas[1].status, 'AVAILABLE')
    assert.deepEqual(Object.keys(areas[0]).sort(), [
      'archiveComment',
      'archivedAt',
      // biome-ignore lint/security/noSecrets: This is a public DTO field name, not a secret.
      'archivedByUserId',
      'createdAt',
      'id',
      'latitude',
      'longitude',
      'name',
      'reactivatedAt',
      'reactivatedByUserId',
      'reactivationComment',
      'status',
      'updatedAt',
    ])
  })

  test('rejects unauthenticated and unauthorized creation', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const payload = { name: 'Scale A', latitude: 1, longitude: 2 }
    const unauthenticated = await client.post('/api/v1/weighing-areas').json(payload)
    const unauthorized = await client.post('/api/v1/weighing-areas').loginAs(observer).json(payload)

    unauthenticated.assertStatus(401)
    unauthorized.assertStatus(403)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects whitespace-only names during creation with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/weighing-areas')
      .loginAs(admin)
      .json({ name: '   ', latitude: 48.1, longitude: 2.3 })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'name')
    assert.equal(response.body().error.details[0].rule, 'required')
  })

  test('creates, lists, updates, archives, and reactivates an area', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const created = await client
      .post('/api/v1/weighing-areas')
      .loginAs(admin)
      .json({ name: '  Scale A  ', latitude: 48.1, longitude: 2.3 })

    created.assertStatus(201)
    assert.equal(created.body().data.name, 'Scale A')
    assert.equal(created.body().data.latitude, 48.1)

    const areaId = created.body().data.id
    const listed = await client.get('/api/v1/weighing-areas').loginAs(admin)

    listed.assertStatus(200)
    assert.include(
      listed.body().data.map((area: { id: string }) => area.id),
      areaId,
    )

    const updated = await client
      .patch(`/api/v1/weighing-areas/${areaId}`)
      .loginAs(admin)
      .json({ name: 'Scale B', longitude: 2.4 })

    updated.assertStatus(200)
    assert.equal(updated.body().data.id, areaId)
    assert.equal(updated.body().data.name, 'Scale B')

    const archived = await client
      .post(`/api/v1/weighing-areas/${areaId}/archive`)
      .loginAs(admin)
      .json({ comment: 'Retired' })

    archived.assertStatus(200)
    assert.equal(archived.body().data.status, 'ARCHIVED')

    const reactivated = await client
      .post(`/api/v1/weighing-areas/${areaId}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Returning' })

    reactivated.assertStatus(200)
    assert.equal(reactivated.body().data.id, areaId)
    assert.equal(reactivated.body().data.status, 'AVAILABLE')
  })

  test('rejects whitespace-only names during update with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: '   ', latitude: 48.2 })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'name')
    assert.equal(response.body().error.details[0].rule, 'required')
  })

  test('exposes archived history but excludes it from available selections', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const area = await WeighingAreaFactory.apply('archived')
      .merge({ name: 'Historic Scale', latitude: 48.4, longitude: 2.7 })
      .create()
    const show = await client.get(`/api/v1/weighing-areas/${area.id}`).loginAs(user)

    show.assertStatus(404)

    const available = await client.get('/api/v1/weighing-areas/available').loginAs(user)

    available.assertStatus(200)
    assert.notInclude(
      available.body().data.map((item: { id: string }) => item.id),
      area.id,
    )
  })

  test('does not expose a weighing-area item-detail route', async ({ client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()

    const response = await client.get(`/api/v1/weighing-areas/${area.id}`).loginAs(admin)

    response.assertStatus(404)
  })

  test('rejects impossible coordinates with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/weighing-areas')
      .loginAs(admin)
      .json({ name: 'Invalid', latitude: 91, longitude: 0 })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'latitude')
  })
})
