import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ClosedDischargeUsageChecker from '#site_references/shared/closed_discharge_usage_checker'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import UsedChecker from '#site_references/shared/used_checker'
import ArchiveTruckUseCase from '#trucks/archive/archive_truck_use_case'
import {
  SuspendedTruckReadOnlyException,
  TruckAlreadyArchivedException,
  TruckInUseException,
  TruckNotFoundException,
} from '#trucks/shared/truck_exceptions'

test.group('ArchiveTruckUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives an unused truck with lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()
    const archivedAt = DateTime.fromISO('2026-08-24T09:00:00.000+02:00')
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const archived = await (await app.container.make(ArchiveTruckUseCase)).handle({
      id: truck.id,
      archivedByUserId: actor.id,
      archivedAt,
      comment: '  Returned to the leasing company  ',
    })

    assert.equal(archived.status, 'ARCHIVED')
    assert.equal(archived.archiveComment, 'Returned to the leasing company')
    assert.equal(archived.archivedByUserId, actor.id)
    assert.equal(archived.archivedAt?.toISO(), archivedAt.toISO())
  })

  test('archives a truck without a comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const archived = await (await app.container.make(ArchiveTruckUseCase)).handle({
      id: truck.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.isNull(archived.archiveComment)
  })

  test('treats a whitespace-only comment as no comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    const archived = await (await app.container.make(ArchiveTruckUseCase)).handle({
      id: truck.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '   ',
    })

    assert.isNull(archived.archiveComment)
  })

  test('preserves attributes and prior reactivation context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('reactivated').create()
    await truck.refresh()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    const registration = truck.registration
    const vehicleModel = truck.vehicleModel
    const capacityTonnes = truck.capacityTonnes.toString()
    const transportCompanyId = truck.transportCompanyId
    const reactivatedAt = truck.reactivatedAt

    const archived = await (await app.container.make(ArchiveTruckUseCase)).handle({
      id: truck.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(archived.registration, registration)
    assert.equal(archived.vehicleModel, vehicleModel)
    assert.equal(archived.capacityTonnes.toString(), capacityTonnes)
    assert.equal(archived.transportCompanyId, transportCompanyId)
    assert.equal(archived.reactivatedAt?.toISO(), reactivatedAt?.toISO())
  })

  test('rejects a missing truck', async ({ assert }) => {
    const useCase = await app.container.make(ArchiveTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-0000-0000-000000000000',
          archivedByUserId: '00000000-0000-0000-0000-000000000001',
          archivedAt: DateTime.now(),
          comment: null,
        }),
      TruckNotFoundException,
    )
  })

  test('blocks planned or active usage and repeated archival', async ({ assert }) => {
    const truck = await TruckFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))
    const useCase = await app.container.make(ArchiveTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          archivedByUserId: truck.id,
          archivedAt: DateTime.now(),
          comment: null,
        }),
      TruckInUseException,
    )

    const archived = await TruckFactory.apply('archived').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    await assert.rejects(
      () =>
        useCase.handle({
          id: archived.id,
          archivedByUserId: truck.id,
          archivedAt: DateTime.now(),
          comment: null,
        }),
      TruckAlreadyArchivedException,
    )
  })

  test('allows closed-only usage', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()
    app.container.swap(SiteReferenceUsageChecker, () =>
      app.container.make(ClosedDischargeUsageChecker),
    )

    const archived = await (await app.container.make(ArchiveTruckUseCase)).handle({
      id: truck.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(archived.status, 'ARCHIVED')
  })

  test('refuses to archive a suspended truck and leaves it suspended', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ suspensionComment: 'In the workshop' })
      .create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))

    await assert.rejects(
      () =>
        (async () =>
          (await app.container.make(ArchiveTruckUseCase)).handle({
            id: truck.id,
            archivedByUserId: actor.id,
            archivedAt: DateTime.now(),
            comment: null,
          }))(),
      SuspendedTruckReadOnlyException.message,
    )

    await truck.refresh()
    assert.equal(truck.status, 'SUSPENDED')
    assert.equal(truck.suspensionComment, 'In the workshop')
    assert.isNull(truck.archivedAt)
  })
})
