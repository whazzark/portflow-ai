import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import ArchiveDockUseCase from '#docks/archive/archive_dock_use_case'
import ReactivateDockUseCase from '#docks/reactivate/reactivate_dock_use_case'
import ReactivateDocksUseCase from '#docks/reactivate/reactivate_docks_use_case'
import {
  type DockLifecycleRecord,
  findBulkBlockers,
  indexDocksById,
} from '#docks/shared/dock_lifecycle_blockers'

test.group('ReactivateDocksUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates eligible docks and reports blockers in request order', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const archived = await DockFactory.apply('archived').create()
    const available = await DockFactory.create()
    const result = await (await app.container.make(ReactivateDocksUseCase)).handle({
      ids: [archived.id, available.id, '00000000-0000-0000-0000-000000000000'],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Back in service  ',
    })

    assert.deepEqual(
      result.updatedDocks.map((dock) => dock.id),
      [archived.id],
    )
    assert.deepEqual(
      result.blockedDocks.map((blocker) => [blocker.id, blocker.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('reactivates several docks with a normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const docks = await DockFactory.apply('archived').createMany(2)
    const result = await (await app.container.make(ReactivateDocksUseCase)).handle({
      ids: docks.map((dock) => dock.id),
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Quay reopened  ',
    })

    assert.deepEqual(
      result.updatedDocks.map((dock) => dock.id),
      docks.map((dock) => dock.id),
    )
    assert.isEmpty(result.blockedDocks)
    assert.isTrue(result.updatedDocks.every((dock) => dock.reactivationComment === 'Quay reopened'))
  })

  test('cycles a dock through repeated archive and reactivate transitions', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const dock = await DockFactory.create()

    for (let cycle = 0; cycle < 2; cycle += 1) {
      const archived = await (await app.container.make(ArchiveDockUseCase)).handle({
        id: dock.id,
        archivedByUserId: actor.id,
        archivedAt: DateTime.now(),
        comment: `Archived cycle ${cycle}`,
      })
      assert.equal(archived.status, 'ARCHIVED')

      const reactivated = await (await app.container.make(ReactivateDockUseCase)).handle({
        id: dock.id,
        reactivatedByUserId: actor.id,
        reactivatedAt: DateTime.now(),
        comment: `Reactivated cycle ${cycle}`,
      })
      assert.equal(reactivated.status, 'AVAILABLE')
      assert.equal(reactivated.id, dock.id)
      assert.equal(reactivated.archiveComment, `Archived cycle ${cycle}`)
      assert.equal(reactivated.reactivationComment, `Reactivated cycle ${cycle}`)
    }
  })
})

test.group('findBulkBlockers (reactivation direction)', () => {
  test('produces NOT_FOUND and ALREADY_AVAILABLE, never IN_USE, even when the id is otherwise used', ({
    assert,
  }) => {
    const available: DockLifecycleRecord = {
      id: 'available-id',
      name: 'Available',
      status: 'AVAILABLE',
    }
    const archived: DockLifecycleRecord = {
      id: 'archived-id',
      name: 'Archived',
      status: 'ARCHIVED',
    }
    const docksById = indexDocksById([available, archived])
    const usedIds = new Set([available.id, archived.id])

    const blockers = findBulkBlockers(
      [available.id, archived.id, 'missing-id'],
      docksById,
      'ARCHIVED',
      usedIds,
    )

    assert.deepEqual(
      blockers.map((blocker) => [blocker.id, blocker.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        ['missing-id', 'NOT_FOUND'],
      ],
    )
  })
})
