import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import { createPersistedWeighingAreaUsageScenario } from '../support/persisted_weighing_area_usage.js'

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
    assert.equal(areas[0].archiveComment, 'Historic')
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

  test('rejects a duplicate name during creation with a 409 conflict, matching case-insensitively against available and archived areas', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    await WeighingAreaFactory.merge({ name: 'Conflict Scale Alpha' }).create()
    await WeighingAreaFactory.apply('archived').merge({ name: 'Conflict Scale Beta' }).create()

    const conflictsWithAvailable = await client
      .post('/api/v1/weighing-areas')
      .loginAs(admin)
      .json({ name: '  conflict scale alpha  ', latitude: 1, longitude: 1 })

    conflictsWithAvailable.assertStatus(409)
    assert.equal(conflictsWithAvailable.body().error.code, 'E_WEIGHING_AREA_NAME_CONFLICT')

    const conflictsWithArchived = await client
      .post('/api/v1/weighing-areas')
      .loginAs(admin)
      .json({ name: ' CONFLICT SCALE BETA ', latitude: 1, longitude: 1 })

    conflictsWithArchived.assertStatus(409)
    assert.equal(conflictsWithArchived.body().error.code, 'E_WEIGHING_AREA_NAME_CONFLICT')

    const listed = await client.get('/api/v1/weighing-areas').loginAs(admin)
    assert.equal(
      listed.body().data.filter((area: { name: string }) => area.name === 'Conflict Scale Alpha')
        .length,
      1,
    )
  })

  test('rejects archival when a persisted current shift uses the area', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { weighingArea } = await createPersistedWeighingAreaUsageScenario({ status: 'ACTIVE' })
    const response = await client
      .post(`/api/v1/weighing-areas/${weighingArea.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_IN_USE')
    await weighingArea.refresh()
    assert.equal(weighingArea.status, 'AVAILABLE')
    assert.isNull(weighingArea.archivedAt)
    assert.isNull(weighingArea.archivedByUserId)
    assert.isNull(weighingArea.archiveComment)
  })

  test('allows archival when the membership has ended', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { weighingArea } = await createPersistedWeighingAreaUsageScenario({
      status: 'ACTIVE',
      weighingAreaEnded: true,
    })
    const response = await client
      .post(`/api/v1/weighing-areas/${weighingArea.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test('allows archival when the discharge is closed, even without an ended membership', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { weighingArea } = await createPersistedWeighingAreaUsageScenario({ status: 'CLOSED' })
    const response = await client
      .post(`/api/v1/weighing-areas/${weighingArea.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })

  test('archives a weighing area without a comment, leaving archiveComment null', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
    assert.isNull(response.body().data.archiveComment)
  })

  test('trims a submitted archive comment before storing it', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(admin)
      .json({ comment: '  Decommissioned  ' })

    response.assertStatus(200)
    assert.equal(response.body().data.archiveComment, 'Decommissioned')
  })

  test('stores a whitespace-only archive comment as null', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(admin)
      .json({ comment: '   ' })

    response.assertStatus(200)
    assert.isNull(response.body().data.archiveComment)
  })

  test('rejects an archive comment over 1000 characters and leaves the area untouched', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'AVAILABLE')
    assert.isNull(area.archivedAt)
  })

  test('archiving a previously reactivated weighing area preserves its reactivation context', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const responsible = await UserFactory.apply('active').create()
    const area = await WeighingAreaFactory.apply('reactivated')
      .merge({ reactivatedByUserId: responsible.id, reactivationComment: 'Back in service' })
      .create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Retired again' })

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
    assert.isNotNull(response.body().data.reactivatedAt)
    assert.equal(response.body().data.reactivatedByUserId, responsible.id)
    assert.equal(response.body().data.reactivationComment, 'Back in service')
  })

  test('rejects unauthenticated and non-admin archival attempts on the archive route', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const area = await WeighingAreaFactory.create()

    const unauthenticated = await client.post(`/api/v1/weighing-areas/${area.id}/archive`).json({})
    const unauthorized = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(observer)
      .json({})

    unauthenticated.assertStatus(401)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorized.assertStatus(403)
    assert.equal(unauthorized.body().error.code, 'E_AUTHORIZATION_FAILURE')
    await area.refresh()
    assert.equal(area.status, 'AVAILABLE')
  })

  test('rejects archiving a weighing area that does not exist', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const missingAreaId = '00000000-0000-4000-8000-000000000000'

    const response = await client
      .post(`/api/v1/weighing-areas/${missingAreaId}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_NOT_FOUND')
  })

  test('rejects archiving an already archived weighing area and leaves its context unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archiver = await UserFactory.apply('active').create()
    const originalArchivedAt = DateTime.fromISO('2026-01-01T00:00:00.000Z')
    const area = await WeighingAreaFactory.apply('archived')
      .merge({
        archivedAt: originalArchivedAt,
        archivedByUserId: archiver.id,
        archiveComment: 'Original reason',
      })
      .create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Attempted second archival' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_ALREADY_ARCHIVED')
    await area.refresh()
    assert.equal(area.archivedByUserId, archiver.id)
    assert.equal(area.archiveComment, 'Original reason')
    assert.isTrue(area.archivedAt?.equals(originalArchivedAt))
  })

  test('archives exactly one weighing area when two requests race for it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()

    const [first, second] = await Promise.all([
      client
        .post(`/api/v1/weighing-areas/${area.id}/archive`)
        .loginAs(admin)
        .json({ comment: 'First' }),
      client
        .post(`/api/v1/weighing-areas/${area.id}/archive`)
        .loginAs(admin)
        .json({ comment: 'Second' }),
    ])

    const statuses = [first.status(), second.status()].sort()
    assert.deepEqual(statuses, [200, 409])
    const winner = first.status() === 200 ? first : second
    const loser = first.status() === 200 ? second : first
    assert.equal(loser.body().error.code, 'E_WEIGHING_AREA_ALREADY_ARCHIVED')

    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
    assert.equal(area.archiveComment, winner.body().data.archiveComment)
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

  test('rejects an empty update body with the shared validation envelope', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.create()
    const response = await client.patch(`/api/v1/weighing-areas/${area.id}`).loginAs(admin).json({})

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'name')
    assert.equal(response.body().error.details[0].rule, 'required')
  })

  test('trims a submitted name on update, matching creation', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.merge({ name: 'Old Scale' }).create()
    const response = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: '  Trimmed Scale  ' })

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Trimmed Scale')
  })

  test('rejects duplicate weighing-area names during updates, including case, whitespace, and archived areas', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const existingAvailable = await WeighingAreaFactory.merge({ name: 'Existing Scale' }).create()
    const existingArchived = await WeighingAreaFactory.apply('archived')
      .merge({ name: 'Archived Name' })
      .create()
    const area = await WeighingAreaFactory.merge({ name: 'Duplicate Target' }).create()

    const exactResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: existingAvailable.name })
    const caseAndWhitespaceResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: `  ${existingAvailable.name.toUpperCase()}  ` })
    const archivedNameResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: existingArchived.name })

    for (const response of [exactResponse, caseAndWhitespaceResponse, archivedNameResponse]) {
      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_WEIGHING_AREA_NAME_CONFLICT')
    }

    const listResponse = await client.get('/api/v1/weighing-areas').loginAs(admin)
    const stored = listResponse.body().data.find((entry: { id: string }) => entry.id === area.id)
    assert.equal(stored.name, 'Duplicate Target')
  })

  test('accepts resubmitting a weighing area own current name, exactly or with different casing, without conflict', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.merge({ name: 'Self Name Scale' }).create()

    const exactResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: area.name, latitude: area.latitude, longitude: area.longitude })

    exactResponse.assertStatus(200)
    assert.equal(exactResponse.body().data.name, area.name)

    const differentCaseResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: area.name.toUpperCase() })

    differentCaseResponse.assertStatus(200)
    assert.equal(differentCaseResponse.body().data.name, area.name.toUpperCase())
  })

  test('rejects out-of-range coordinates during updates and accepts the exact boundary values', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const outOfRangeArea = await WeighingAreaFactory.create()

    const outOfRangeLatitude = await client
      .patch(`/api/v1/weighing-areas/${outOfRangeArea.id}`)
      .loginAs(admin)
      .json({ latitude: 91 })
    const outOfRangeLongitude = await client
      .patch(`/api/v1/weighing-areas/${outOfRangeArea.id}`)
      .loginAs(admin)
      .json({ longitude: -181 })

    for (const [response, field] of [
      [outOfRangeLatitude, 'latitude'],
      [outOfRangeLongitude, 'longitude'],
    ] as const) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.equal(response.body().error.details[0].field, field)
      // The `required` rule is already covered by the empty-update test above; this asserts the
      // *range* rule is actually exercised over HTTP, which was previously untested.
      assert.notEqual(response.body().error.details[0].rule, 'required')
    }

    for (const coordinates of [
      { latitude: 90 },
      { latitude: -90 },
      { longitude: 180 },
      { longitude: -180 },
    ]) {
      const boundaryArea = await WeighingAreaFactory.create()
      const response = await client
        .patch(`/api/v1/weighing-areas/${boundaryArea.id}`)
        .loginAs(admin)
        .json(coordinates)

      response.assertStatus(200)
    }
  })

  test('rejects unauthenticated and unauthorized weighing-area updates', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const area = await WeighingAreaFactory.create()
    const unauthenticatedResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .json({ name: 'Updated' })
    const unauthorizedResponse = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(observer)
      .json({ name: 'Updated' })

    unauthenticatedResponse.assertStatus(401)
    assert.equal(unauthenticatedResponse.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    unauthorizedResponse.assertStatus(403)
    assert.equal(unauthorizedResponse.body().error.code, 'E_AUTHORIZATION_FAILURE')

    const listResponse = await client.get('/api/v1/weighing-areas').loginAs(admin)
    const stored = listResponse.body().data.find((entry: { id: string }) => entry.id === area.id)
    assert.equal(stored.name, area.name)
  })

  test('rejects updates to an archived weighing area as read-only and leaves it unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived')
      .merge({ name: 'Archived Update Target' })
      .create()

    const response = await client
      .patch(`/api/v1/weighing-areas/${area.id}`)
      .loginAs(admin)
      .json({ name: 'Attempted Rename' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_ARCHIVED')

    const listResponse = await client.get('/api/v1/weighing-areas').loginAs(admin)
    const stored = listResponse.body().data.find((entry: { id: string }) => entry.id === area.id)
    assert.equal(stored.name, 'Archived Update Target')
    assert.equal(stored.status, 'ARCHIVED')
  })

  test('rejects updates to a weighing area that does not exist', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const missingAreaId = '00000000-0000-4000-8000-000000000000'

    const response = await client
      .patch(`/api/v1/weighing-areas/${missingAreaId}`)
      .loginAs(admin)
      .json({ name: 'Ghost Scale' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_NOT_FOUND')
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

  test('refuses to reactivate an unknown weighing area without touching any other area', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const bystander = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post('/api/v1/weighing-areas/2c1d9a4e-6f3b-4c8a-9d5e-1b7f0a2c3d4e/reactivate')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_NOT_FOUND')
    await bystander.refresh()
    assert.equal(bystander.status, 'ARCHIVED')
    assert.isNull(bystander.reactivatedAt)
  })

  test('refuses to reactivate an already available weighing area and leaves its context intact', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const responsible = await UserFactory.apply('active').create()
    const area = await WeighingAreaFactory.apply('reactivated')
      .merge({ reactivatedByUserId: responsible.id, reactivationComment: 'Back in service' })
      .create()
    // Read the stored value back before asserting on it: the in-memory DateTime keeps
    // milliseconds the column does not, so comparing against it would fail on precision alone.
    await area.refresh()
    const previousReactivatedAt = area.reactivatedAt

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Again' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WEIGHING_AREA_ALREADY_AVAILABLE')
    await area.refresh()
    assert.equal(area.status, 'AVAILABLE')
    assert.equal(area.reactivatedByUserId, responsible.id)
    assert.equal(area.reactivationComment, 'Back in service')
    assert.equal(area.reactivatedAt?.toMillis(), previousReactivatedAt?.toMillis())
  })

  test('rejects unauthenticated, non-active, and non-admin reactivation attempts', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const deactivatedAdmin = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const unauthenticated = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .json({})
    const unauthorized = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .loginAs(observer)
      .json({})
    const nonActive = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .loginAs(deactivatedAdmin)
      .json({})

    unauthenticated.assertStatus(401)
    unauthorized.assertStatus(403)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal(unauthorized.body().error.code, 'E_AUTHORIZATION_FAILURE')
    assert.isAtLeast(nonActive.status(), 400)
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
    assert.isNull(area.reactivatedAt)
  })

  test('records reactivation context, preserves archive context, and leaves identity untouched', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const archivedBy = await UserFactory.apply('active').create()
    const archivedAt = DateTime.fromISO('2026-01-05T08:30:00.000Z')
    const area = await WeighingAreaFactory.apply('archived')
      .merge({
        name: 'Calibration Scale',
        latitude: 48.11,
        longitude: 2.31,
        archivedAt,
        archivedByUserId: archivedBy.id,
        archiveComment: 'Out for calibration',
      })
      .create()
    await area.refresh()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: '  Back in service after calibration  ' })

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.status, 'AVAILABLE')
    assert.equal(body.reactivatedByUserId, admin.id)
    assert.isNotNull(body.reactivatedAt)
    assert.equal(body.reactivationComment, 'Back in service after calibration')
    assert.equal(body.archivedByUserId, archivedBy.id)
    assert.equal(body.archiveComment, 'Out for calibration')
    assert.isNotNull(body.archivedAt)
    assert.equal(body.id, area.id)
    assert.equal(body.name, 'Calibration Scale')
    assert.equal(body.latitude, 48.11)
    assert.equal(body.longitude, 2.31)
    assert.equal(body.createdAt, area.createdAt.toISO())
  })

  test('stores no reactivation comment when the supplied comment is whitespace only', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: '   ' })

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'AVAILABLE')
    assert.isNull(response.body().data.reactivationComment)
  })

  test('returns a reactivated weighing area to the available collection', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const before = await client.get('/api/v1/weighing-areas/available').loginAs(admin)
    assert.notInclude(
      before.body().data.map((item: { id: string }) => item.id),
      area.id,
    )

    await client.post(`/api/v1/weighing-areas/${area.id}/reactivate`).loginAs(admin).json({})

    const after = await client.get('/api/v1/weighing-areas/available').loginAs(admin)
    assert.include(
      after.body().data.map((item: { id: string }) => item.id),
      area.id,
    )
  })

  test('rejects a reactivation comment over 1000 characters and leaves the area archived', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const area = await WeighingAreaFactory.apply('archived').create()

    const response = await client
      .post(`/api/v1/weighing-areas/${area.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await area.refresh()
    assert.equal(area.status, 'ARCHIVED')
    assert.isNull(area.reactivatedAt)
    assert.isNull(area.reactivatedByUserId)
    assert.isNull(area.reactivationComment)
  })
})
