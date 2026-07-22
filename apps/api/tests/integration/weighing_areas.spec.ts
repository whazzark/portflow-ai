import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'

test.group('Weighing areas administration', () => {
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

    show.assertStatus(200)
    assert.equal(show.body().data.latitude, 48.4)

    const available = await client.get('/api/v1/weighing-areas/available').loginAs(user)

    available.assertStatus(200)
    assert.notInclude(
      available.body().data.map((item: { id: string }) => item.id),
      area.id,
    )
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
