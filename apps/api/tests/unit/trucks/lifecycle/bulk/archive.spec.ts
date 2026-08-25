import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import ArchiveTrucksUseCase from '#trucks/archive/archive_trucks_use_case'

test.group('ArchiveTrucksUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives eligible trucks and reports blockers in request order', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await TruckFactory.create()
    const archived = await TruckFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const result = await (await app.container.make(ArchiveTrucksUseCase)).handle({
      ids: [available.id, archived.id, '00000000-0000-0000-0000-000000000000'],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Fleet cleanup  ',
    })

    assert.deepEqual(
      result.updatedTrucks.map((truck) => truck.id),
      [available.id],
    )
    assert.deepEqual(
      result.blockedTrucks.map((blocker) => [blocker.id, blocker.reason]),
      [
        [archived.id, 'ALREADY_ARCHIVED'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('omits registration for a not-found blocker', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const result = await (await app.container.make(ArchiveTrucksUseCase)).handle({
      ids: ['00000000-0000-0000-0000-000000000000'],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.deepEqual(result.blockedTrucks, [
      { id: '00000000-0000-0000-0000-000000000000', reason: 'NOT_FOUND' },
    ])
  })

  test('archives several trucks with a shared, normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const trucks = await TruckFactory.createMany(2)
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const result = await (await app.container.make(ArchiveTrucksUseCase)).handle({
      ids: trucks.map((truck) => truck.id),
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Portfolio cleanup  ',
    })

    assert.deepEqual(
      result.updatedTrucks.map((truck) => truck.id),
      trucks.map((truck) => truck.id),
    )
    assert.isEmpty(result.blockedTrucks)
    assert.isTrue(
      result.updatedTrucks.every((truck) => truck.archiveComment === 'Portfolio cleanup'),
    )
    const archivedAtValues = new Set(result.updatedTrucks.map((truck) => truck.archivedAt?.toISO()))
    assert.equal(archivedAtValues.size, 1)
    assert.isTrue(result.updatedTrucks.every((truck) => truck.archivedByUserId === actor.id))
  })

  test('archives nothing when every submitted truck is ineligible', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const archivedTrucks = await TruckFactory.apply('archived').createMany(2)
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const result = await (await app.container.make(ArchiveTrucksUseCase)).handle({
      ids: archivedTrucks.map((truck) => truck.id),
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.isEmpty(result.updatedTrucks)
    assert.equal(result.blockedTrucks.length, 2)
    assert.isTrue(result.blockedTrucks.every((blocker) => blocker.reason === 'ALREADY_ARCHIVED'))
  })

  test('reports a suspended truck with its own reason and still archives the rest', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await TruckFactory.create()
    const suspended = await TruckFactory.apply('suspended').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const result = await (await app.container.make(ArchiveTrucksUseCase)).handle({
      ids: [available.id, suspended.id],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.deepEqual(
      result.updatedTrucks.map((truck) => truck.id),
      [available.id],
    )
    assert.deepEqual(
      result.blockedTrucks.map((blocker) => [blocker.id, blocker.reason]),
      [[suspended.id, 'SUSPENDED']],
    )
    await suspended.refresh()
    assert.equal(suspended.status, 'SUSPENDED')
  })
})
