import { randomUUID } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import Truck from '#models/truck'
import ListAvailableTrucksUseCase from '#trucks/available/list_available_trucks_use_case'
import ListTrucksUseCase from '#trucks/list/list_trucks_use_case'

test.group('Truck consultation persistence', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('creates a valid transport company when the factory is used standalone', async ({
    assert,
  }) => {
    const truck = await TruckFactory.create()
    assert.isString(truck.transportCompanyId)
  })

  test('assigns a UUID and retains nullable lifecycle actors', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()

    assert.match(truck.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.isNull(truck.archivedByUserId)
    assert.isNull(truck.reactivatedByUserId)
  })

  test('enforces case-insensitive registration uniqueness across lifecycle states', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    await TruckFactory.merge({
      registration: 'AB-123-CD',
      transportCompanyId: company.id,
    }).create()

    await assert.rejects(() =>
      TruckFactory.apply('archived')
        .merge({ registration: 'ab-123-cd', transportCompanyId: company.id })
        .create(),
    )
  })

  test('rejects non-positive capacity', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()

    await assert.rejects(() =>
      TruckFactory.merge({ capacityTonnes: '0', transportCompanyId: company.id }).create(),
    )
  })

  test('requires a current transport company', async ({ assert }) => {
    await assert.rejects(() =>
      Truck.create({
        registration: 'NO-COMPANY',
        capacityTonnes: '1',
        transportCompanyId: randomUUID(),
        status: 'AVAILABLE',
      }),
    )
  })

  test('requires archive time for archived rows', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()

    await assert.rejects(() =>
      Truck.create({
        registration: 'ARCHIVE-NO-DATE',
        capacityTonnes: '1',
        transportCompanyId: company.id,
        status: 'ARCHIVED',
        archivedAt: null,
      }),
    )
  })

  test('persists archived and reactivated lifecycle context with nullable actors', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    const archivedAt = DateTime.utc(2026, 7, 20, 14, 32, 11)
    const reactivatedAt = DateTime.utc(2026, 7, 28, 8)
    const archived = await TruckFactory.apply('archived')
      .merge({ archivedAt, transportCompanyId: company.id })
      .create()
    const reactivated = await TruckFactory.apply('reactivated')
      .merge({ archivedAt, reactivatedAt, transportCompanyId: company.id })
      .create()

    assert.equal(archived.status, 'ARCHIVED')
    assert.equal(archived.archivedAt?.toISO(), archivedAt.toISO())
    assert.isNull(archived.archivedByUserId)
    assert.equal(reactivated.status, 'AVAILABLE')
    assert.equal(reactivated.reactivatedAt?.toISO(), reactivatedAt.toISO())
    assert.isNull(reactivated.reactivatedByUserId)
  })
})

test.group('Truck consultation repositories', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('lists complete and available collections in deterministic registration order', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    const zulu = await TruckFactory.merge({
      registration: 'Zulu-300',
      transportCompanyId: company.id,
    }).create()
    const alpha = await TruckFactory.apply('archived')
      .merge({ registration: 'alpha-100', transportCompanyId: company.id })
      .create()
    const beta = await TruckFactory.merge({
      registration: 'Beta-200',
      transportCompanyId: company.id,
    }).create()

    const complete = await (await app.container.make(ListTrucksUseCase)).handle()
    const available = await (await app.container.make(ListAvailableTrucksUseCase)).handle()
    const ids = new Set([zulu.id, alpha.id, beta.id])

    assert.deepEqual(
      complete.filter((truck) => ids.has(truck.id)).map((truck) => truck.id),
      [alpha.id, beta.id, zulu.id],
    )
    assert.deepEqual(
      available.filter((truck) => ids.has(truck.id)).map((truck) => truck.id),
      [beta.id, zulu.id],
    )
  })

  test('preserves the current company reference and nullable lifecycle actors for the snapshot', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.merge({ name: 'Current Provider' }).create()
    const actor = await UserFactory.apply('active').create()
    const archived = await TruckFactory.apply('archived')
      .merge({
        registration: 'ACTOR-001',
        transportCompanyId: company.id,
        archivedByUserId: actor.id,
      })
      .create()

    const complete = await (await app.container.make(ListTrucksUseCase)).handle()
    const truck = complete.find((candidate) => candidate.id === archived.id)

    assert.equal(truck?.transportCompanyId, company.id)
    assert.equal(truck?.archivedBy.id, actor.id)
    assert.isNull(truck?.reactivatedBy ?? null)
  })

  test('reflects authoritative lifecycle and provider changes on a later read', async ({
    assert,
  }) => {
    const originalCompany = await TransportCompanyFactory.merge({
      name: 'Original Provider',
    }).create()
    const replacementCompany = await TransportCompanyFactory.merge({
      name: 'Replacement Provider',
    }).create()
    const truck = await TruckFactory.merge({
      registration: 'REFRESH-001',
      transportCompanyId: originalCompany.id,
    }).create()

    await (await app.container.make(ListAvailableTrucksUseCase)).handle()
    truck.transportCompanyId = replacementCompany.id
    truck.status = 'ARCHIVED'
    truck.archivedAt = DateTime.now()
    await truck.save()

    const complete = await (await app.container.make(ListTrucksUseCase)).handle()
    const refreshed = complete.find((candidate) => candidate.id === truck.id)

    assert.equal(refreshed?.status, 'ARCHIVED')
    assert.equal(refreshed?.transportCompanyId, replacementCompany.id)
  })
})
