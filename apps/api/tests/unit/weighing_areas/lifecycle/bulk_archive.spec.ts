import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import ArchiveWeighingAreasUseCase from '#weighing_areas/archive/archive_weighing_areas_use_case'

test.group('ArchiveWeighingAreasUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives eligible weighing areas and reports blockers in request order', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await WeighingAreaFactory.create()
    const archived = await WeighingAreaFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const result = await (await app.container.make(ArchiveWeighingAreasUseCase)).handle({
      ids: [available.id, archived.id, '00000000-0000-0000-0000-000000000000'],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Cleanup  ',
    })

    assert.deepEqual(
      result.updatedWeighingAreas.map((area) => area.id),
      [available.id],
    )
    assert.deepEqual(
      result.blockedWeighingAreas.map((blocker) => [blocker.id, blocker.reason]),
      [
        [archived.id, 'ALREADY_ARCHIVED'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('archives several weighing areas with a normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const areas = await WeighingAreaFactory.createMany(2)
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const result = await (await app.container.make(ArchiveWeighingAreasUseCase)).handle({
      ids: areas.map((area) => area.id),
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  End-of-campaign cleanup  ',
    })

    assert.deepEqual(
      result.updatedWeighingAreas.map((area) => area.id),
      areas.map((area) => area.id),
    )
    assert.isEmpty(result.blockedWeighingAreas)
    assert.isTrue(
      result.updatedWeighingAreas.every(
        (area) => area.archiveComment === 'End-of-campaign cleanup',
      ),
    )
  })
})
