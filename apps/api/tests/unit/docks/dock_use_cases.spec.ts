import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import ArchiveDockUseCase from '#docks/archive/archive_dock_use_case'
import CreateDockUseCase from '#docks/create/create_dock_use_case'
import ReactivateDockUseCase from '#docks/reactivate/reactivate_dock_use_case'
import {
  ArchivedDockReadOnlyException,
  DockAlreadyArchivedException,
  DockAlreadyAvailableException,
  DockInUseException,
  DockNotFoundException,
  DuplicateDockNameException,
} from '#docks/shared/dock_exceptions'
import UpdateDockUseCase from '#docks/update/update_dock_use_case'
import ClosedDischargeUsageChecker from '#site_references/shared/closed_discharge_usage_checker'
import {
  InvalidSiteReferenceCoordinatesException,
  InvalidSiteReferenceNameException,
} from '#site_references/shared/site_reference_exceptions'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import UsedChecker from '#site_references/shared/used_checker'

test.group('Dock use cases', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('normalizes the name and preserves legal boundary coordinates', async ({ assert }) => {
    const useCase = await app.container.make(CreateDockUseCase)
    const dock = await useCase.handle({ name: '  North Dock  ', latitude: -90, longitude: 180 })

    assert.equal(dock.name, 'North Dock')
    assert.equal(dock.latitude, -90)
    assert.equal(dock.longitude, 180)
    assert.equal(dock.status, 'AVAILABLE')
  })

  test('updates current name and coordinates while preserving identity', async ({ assert }) => {
    const dock = await DockFactory.create()
    const updated = await (await app.container.make(UpdateDockUseCase)).handle({
      id: dock.id,
      name: 'Corrected Dock',
      latitude: 48.12,
      longitude: 2.34,
    })

    assert.equal(updated.id, dock.id)
    assert.equal(updated.name, 'Corrected Dock')
    assert.equal(updated.latitude, 48.12)
    assert.equal(updated.longitude, 2.34)
  })

  test('rejects empty names and illegal coordinates during creation', async ({ assert }) => {
    const useCase = await app.container.make(CreateDockUseCase)

    await assert.rejects(
      () => useCase.handle({ name: '   ', latitude: 0, longitude: 0 }),
      InvalidSiteReferenceNameException,
    )
    await assert.rejects(
      () => useCase.handle({ name: 'Dock', latitude: 90.1, longitude: 0 }),
      InvalidSiteReferenceCoordinatesException,
    )
    await assert.rejects(
      () => useCase.handle({ name: 'Dock', latitude: 0, longitude: -180.1 }),
      InvalidSiteReferenceCoordinatesException,
    )
  })

  test('rejects empty names and illegal coordinates during updates', async ({ assert }) => {
    const dock = await DockFactory.create()
    const useCase = await app.container.make(UpdateDockUseCase)

    await assert.rejects(
      () => useCase.handle({ id: dock.id, name: '   ' }),
      InvalidSiteReferenceNameException,
    )
    await assert.rejects(
      () => useCase.handle({ id: dock.id, latitude: 90.1 }),
      InvalidSiteReferenceCoordinatesException,
    )
    await assert.rejects(
      () => useCase.handle({ id: dock.id, longitude: -180.1 }),
      InvalidSiteReferenceCoordinatesException,
    )
  })

  test('archives an unused dock and records lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const dock = await DockFactory.create()
    const archivedAt = DateTime.fromISO('2026-07-22T12:00:00.000+02:00')
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const archived = await (await app.container.make(ArchiveDockUseCase)).handle({
      id: dock.id,
      archivedByUserId: actor.id,
      archivedAt,
      comment: '  Retired dock  ',
    })

    assert.equal(archived.status, 'ARCHIVED')
    assert.equal(archived.archiveComment, 'Retired dock')
    assert.equal(archived.archivedByUserId, actor.id)
    assert.equal(archived.archivedAt?.toISO(), archivedAt.toISO())
  })

  test('allows archival for closed-only usage and reactivates the same identity', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const dock = await DockFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () =>
      app.container.make(ClosedDischargeUsageChecker),
    )
    await (await app.container.make(ArchiveDockUseCase)).handle({
      id: dock.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    const reactivated = await (await app.container.make(ReactivateDockUseCase)).handle({
      id: dock.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: 'Returning',
    })

    assert.equal(reactivated.id, dock.id)
    assert.equal(reactivated.status, 'AVAILABLE')
    assert.equal(reactivated.reactivatedByUserId, actor.id)
  })

  test('rejects mutation attempts for a missing dock', async ({ assert }) => {
    const missingDockId = '00000000-0000-4000-8000-000000000000'
    const actor = await UserFactory.apply('active').create()

    await assert.rejects(
      () =>
        app.container
          .make(UpdateDockUseCase)
          .then((useCase) => useCase.handle({ id: missingDockId, name: 'Missing Dock' })),
      DockNotFoundException,
    )
    await assert.rejects(
      () =>
        app.container.make(ArchiveDockUseCase).then((useCase) =>
          useCase.handle({
            id: missingDockId,
            archivedByUserId: actor.id,
            archivedAt: DateTime.now(),
          }),
        ),
      DockNotFoundException,
    )
    await assert.rejects(
      () =>
        app.container.make(ReactivateDockUseCase).then((useCase) =>
          useCase.handle({
            id: missingDockId,
            reactivatedByUserId: actor.id,
            reactivatedAt: DateTime.now(),
          }),
        ),
      DockNotFoundException,
    )
  })

  test('keeps archived docks read-only', async ({ assert }) => {
    const dock = await DockFactory.apply('archived').create()

    await assert.rejects(
      () =>
        app.container
          .make(UpdateDockUseCase)
          .then((useCase) => useCase.handle({ id: dock.id, name: 'New Name' })),
      ArchivedDockReadOnlyException,
    )
  })

  test('blocks archival when a planned or active discharge uses the dock', async ({ assert }) => {
    const dock = await DockFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))

    await assert.rejects(
      () =>
        app.container
          .make(ArchiveDockUseCase)
          .then((useCase) =>
            useCase.handle({ id: dock.id, archivedByUserId: dock.id, archivedAt: DateTime.now() }),
          ),
      DockInUseException,
    )
  })

  test('enforces normalized uniqueness across available and archived docks', async ({ assert }) => {
    const northDock = await DockFactory.merge({ name: 'North Dock' }).create()
    await DockFactory.apply('archived').merge({ name: 'South Dock' }).create()

    await assert.rejects(
      () =>
        app.container
          .make(CreateDockUseCase)
          .then((useCase) => useCase.handle({ name: ' north dock ', latitude: 1, longitude: 1 })),
      DuplicateDockNameException,
    )
    await assert.rejects(
      () =>
        app.container
          .make(CreateDockUseCase)
          .then((useCase) => useCase.handle({ name: ' SOUTH DOCK ', latitude: 1, longitude: 1 })),
      DuplicateDockNameException,
    )
    await assert.rejects(
      () =>
        app.container
          .make(UpdateDockUseCase)
          .then((useCase) => useCase.handle({ id: northDock.id, name: ' SOUTH DOCK ' })),
      DuplicateDockNameException,
    )
  })

  test('rejects repeated lifecycle transitions', async ({ assert }) => {
    const available = await DockFactory.create()
    const archived = await DockFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    await assert.rejects(
      () =>
        app.container.make(ArchiveDockUseCase).then((useCase) =>
          useCase.handle({
            id: archived.id,
            archivedByUserId: available.id,
            archivedAt: DateTime.now(),
          }),
        ),
      DockAlreadyArchivedException,
    )
    await assert.rejects(
      () =>
        app.container.make(ReactivateDockUseCase).then((useCase) =>
          useCase.handle({
            id: available.id,
            reactivatedByUserId: archived.id,
            reactivatedAt: DateTime.now(),
          }),
        ),
      DockAlreadyAvailableException,
    )
  })
})
