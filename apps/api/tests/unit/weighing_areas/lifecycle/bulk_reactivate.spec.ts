import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import ReactivateWeighingAreasUseCase from '#weighing_areas/reactivate/reactivate_weighing_areas_use_case'
import {
  findBulkBlockers,
  type WeighingAreaLifecycleRecord,
} from '#weighing_areas/shared/weighing_area_lifecycle_blockers'

const MISSING_ID = '00000000-0000-0000-0000-000000000000'

test.group('findBulkBlockers on the reactivation direction', () => {
  test('reports NOT_FOUND and ALREADY_AVAILABLE, and never IN_USE', ({ assert }) => {
    const available: WeighingAreaLifecycleRecord = {
      id: 'a1',
      name: 'Alpha',
      status: 'AVAILABLE',
    }
    const archived: WeighingAreaLifecycleRecord = { id: 'a2', name: 'Beta', status: 'ARCHIVED' }
    const byId = new Map<string, WeighingAreaLifecycleRecord>([
      [available.id, available],
      [archived.id, archived],
    ])

    // A usage set is passed deliberately: the reactivation direction must ignore it entirely,
    // which is what makes IN_USE structurally unreachable on this path (spec FR-003).
    const blockers = findBulkBlockers(
      [available.id, MISSING_ID, archived.id],
      byId,
      'ARCHIVED',
      new Set([available.id, archived.id]),
    )

    assert.deepEqual(
      blockers.map((blocker) => [blocker.id, blocker.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        [MISSING_ID, 'NOT_FOUND'],
      ],
    )
    assert.equal(blockers[0].name, 'Alpha')
    assert.isUndefined(blockers[1].name)
  })
})

test.group('ReactivateWeighingAreasUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates eligible weighing areas and reports blockers in request order', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const archived = await WeighingAreaFactory.apply('archived').create()
    const available = await WeighingAreaFactory.create()

    const result = await (await app.container.make(ReactivateWeighingAreasUseCase)).handle({
      ids: [available.id, archived.id, MISSING_ID],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Reopening  ',
    })

    assert.deepEqual(
      result.updatedWeighingAreas.map((area) => area.id),
      [archived.id],
    )
    assert.deepEqual(
      result.blockedWeighingAreas.map((blocker) => [blocker.id, blocker.reason]),
      [
        [available.id, 'ALREADY_AVAILABLE'],
        [MISSING_ID, 'NOT_FOUND'],
      ],
    )
    assert.equal(result.updatedWeighingAreas[0].reactivationComment, 'Reopening')
  })

  test('records no comment when the supplied comment is blank', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const areas = await WeighingAreaFactory.apply('archived').createMany(2)

    const result = await (await app.container.make(ReactivateWeighingAreasUseCase)).handle({
      ids: areas.map((area) => area.id),
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '   ',
    })

    assert.lengthOf(result.updatedWeighingAreas, 2)
    assert.isTrue(result.updatedWeighingAreas.every((area) => area.reactivationComment === null))
    assert.isEmpty(result.blockedWeighingAreas)
  })

  test('keeps identity and archive context across a full archive-reactivate cycle', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const area = await WeighingAreaFactory.apply('archived')
      .merge({ name: 'Cycle Scale', archiveComment: 'First closure' })
      .create()

    const result = await (await app.container.make(ReactivateWeighingAreasUseCase)).handle({
      ids: [area.id],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: 'First reopening',
    })

    const reactivated = result.updatedWeighingAreas[0]
    assert.equal(reactivated.id, area.id)
    assert.equal(reactivated.name, 'Cycle Scale')
    assert.equal(reactivated.status, 'AVAILABLE')
    // Both context groups are populated side by side: reactivating never erases the archival that
    // preceded it (spec FR-010, FR-019).
    assert.equal(reactivated.archiveComment, 'First closure')
    assert.isNotNull(reactivated.archivedAt)
    assert.equal(reactivated.reactivationComment, 'First reopening')
    assert.isNotNull(reactivated.reactivatedAt)
  })
})
