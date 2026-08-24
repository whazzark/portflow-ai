import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import ArchiveDocksUseCase from '#docks/archive/archive_docks_use_case'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'

test.group('ArchiveDocksUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives eligible docks and reports blockers in request order', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await DockFactory.create()
    const archived = await DockFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const result = await (await app.container.make(ArchiveDocksUseCase)).handle({
      ids: [available.id, archived.id, '00000000-0000-0000-0000-000000000000'],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Cleanup  ',
    })

    assert.deepEqual(
      result.updatedDocks.map((dock) => dock.id),
      [available.id],
    )
    assert.deepEqual(
      result.blockedDocks.map((blocker) => [blocker.id, blocker.reason]),
      [
        [archived.id, 'ALREADY_ARCHIVED'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('archives several docks with a normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const docks = await DockFactory.createMany(2)
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const result = await (await app.container.make(ArchiveDocksUseCase)).handle({
      ids: docks.map((dock) => dock.id),
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Site reorganization  ',
    })

    assert.deepEqual(
      result.updatedDocks.map((dock) => dock.id),
      docks.map((dock) => dock.id),
    )
    assert.isEmpty(result.blockedDocks)
    assert.isTrue(
      result.updatedDocks.every((dock) => dock.archiveComment === 'Site reorganization'),
    )
  })
})
