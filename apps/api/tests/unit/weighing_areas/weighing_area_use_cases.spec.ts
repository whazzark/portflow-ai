import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import {
  InvalidSiteReferenceCoordinatesException,
  InvalidSiteReferenceNameException,
} from '#site_references/shared/site_reference_exceptions'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import UsedChecker from '#site_references/shared/used_checker'
import ArchiveWeighingAreaUseCase from '#weighing_areas/archive/archive_weighing_area_use_case'
import CreateWeighingAreaUseCase from '#weighing_areas/create/create_weighing_area_use_case'
import ReactivateWeighingAreaUseCase from '#weighing_areas/reactivate/reactivate_weighing_area_use_case'
import {
  ArchivedWeighingAreaReadOnlyException,
  DuplicateWeighingAreaNameException,
  WeighingAreaInUseException,
} from '#weighing_areas/shared/weighing_area_exceptions'
import UpdateWeighingAreaUseCase from '#weighing_areas/update/update_weighing_area_use_case'

test.group('Weighing area use cases', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('creates a normalized area with legal boundary coordinates', async ({ assert }) => {
    const area = await (await app.container.make(CreateWeighingAreaUseCase)).handle({
      name: '  Scale A  ',
      latitude: -90,
      longitude: 180,
    })

    assert.equal(area.name, 'Scale A')
    assert.equal(area.latitude, -90)
    assert.equal(area.longitude, 180)
    assert.equal(area.status, 'AVAILABLE')
  })

  test('updates coordinates while preserving identity', async ({ assert }) => {
    const area = await WeighingAreaFactory.create()
    const updated = await (await app.container.make(UpdateWeighingAreaUseCase)).handle({
      id: area.id,
      name: 'Corrected Scale',
      latitude: 48.12,
      longitude: 2.34,
    })

    assert.equal(updated.id, area.id)
    assert.equal(updated.name, 'Corrected Scale')
    assert.equal(updated.latitude, 48.12)
  })

  test('rejects empty names and illegal coordinates during creation', async ({ assert }) => {
    const useCase = await app.container.make(CreateWeighingAreaUseCase)

    await assert.rejects(
      () => useCase.handle({ name: '   ', latitude: 0, longitude: 0 }),
      InvalidSiteReferenceNameException,
    )
    await assert.rejects(
      () => useCase.handle({ name: 'Area', latitude: Number.NaN, longitude: 0 }),
      InvalidSiteReferenceCoordinatesException,
    )
    await assert.rejects(
      () => useCase.handle({ name: 'Area', latitude: 0, longitude: 180.1 }),
      InvalidSiteReferenceCoordinatesException,
    )
  })

  test('rejects empty names and illegal coordinates during updates', async ({ assert }) => {
    const area = await WeighingAreaFactory.create()
    const useCase = await app.container.make(UpdateWeighingAreaUseCase)

    await assert.rejects(
      () => useCase.handle({ id: area.id, name: '   ' }),
      InvalidSiteReferenceNameException,
    )
    await assert.rejects(
      () => useCase.handle({ id: area.id, latitude: Number.POSITIVE_INFINITY }),
      InvalidSiteReferenceCoordinatesException,
    )
    await assert.rejects(
      () => useCase.handle({ id: area.id, longitude: -180.1 }),
      InvalidSiteReferenceCoordinatesException,
    )
  })

  test('enforces normalized uniqueness across available and archived areas', async ({ assert }) => {
    await WeighingAreaFactory.merge({ name: 'Scale A' }).create()
    await WeighingAreaFactory.apply('archived').merge({ name: 'Scale B' }).create()

    const useCase = await app.container.make(CreateWeighingAreaUseCase)

    await assert.rejects(
      () => useCase.handle({ name: ' scale a ', latitude: 1, longitude: 1 }),
      DuplicateWeighingAreaNameException,
    )

    await assert.rejects(
      () => useCase.handle({ name: ' SCALE B ', latitude: 1, longitude: 1 }),
      DuplicateWeighingAreaNameException,
    )
  })

  test('archives unused areas, reactivates the same identity, and protects archives', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const area = await WeighingAreaFactory.create()

    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const archived = await (await app.container.make(ArchiveWeighingAreaUseCase)).handle({
      id: area.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: ' Retired ',
    })

    assert.equal(archived.status, 'ARCHIVED')
    assert.equal(archived.archiveComment, 'Retired')

    await assert.rejects(
      () =>
        app.container
          .make(UpdateWeighingAreaUseCase)
          .then((useCase) => useCase.handle({ id: area.id, name: 'Changed' })),
      ArchivedWeighingAreaReadOnlyException,
    )

    const reactivated = await (await app.container.make(ReactivateWeighingAreaUseCase)).handle({
      id: area.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.equal(reactivated.id, area.id)
    assert.equal(reactivated.status, 'AVAILABLE')
  })

  test('blocks archival when a planned or active discharge uses the area', async ({ assert }) => {
    const area = await WeighingAreaFactory.create()

    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))

    await assert.rejects(
      () =>
        app.container
          .make(ArchiveWeighingAreaUseCase)
          .then((useCase) =>
            useCase.handle({ id: area.id, archivedByUserId: area.id, archivedAt: DateTime.now() }),
          ),
      WeighingAreaInUseException,
    )
  })
})
