import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ReactivateTruckUseCase from '#trucks/reactivate/reactivate_truck_use_case'
import {
  SuspendedTruckReadOnlyException,
  TruckAlreadyAvailableException,
  TruckNotFoundException,
  TruckTransportCompanyArchivedException,
} from '#trucks/shared/truck_exceptions'
import { createArchivedTruckWithArchivedCompanyScenario } from '../../../support/trucks/lifecycle_fixtures.ts'

test.group('ReactivateTruckUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates an archived truck with lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('archived').create()
    const reactivatedAt = DateTime.fromISO('2026-08-24T09:00:00.000+02:00')

    const reactivated = await (await app.container.make(ReactivateTruckUseCase)).handle({
      id: truck.id,
      reactivatedByUserId: actor.id,
      reactivatedAt,
      comment: '  Back from the gearbox overhaul  ',
    })

    assert.equal(reactivated.status, 'AVAILABLE')
    assert.equal(reactivated.reactivationComment, 'Back from the gearbox overhaul')
    assert.equal(reactivated.reactivatedByUserId, actor.id)
    assert.equal(reactivated.reactivatedAt?.toISO(), reactivatedAt.toISO())
  })

  test('reactivates a truck without a comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('archived').create()

    const reactivated = await (await app.container.make(ReactivateTruckUseCase)).handle({
      id: truck.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: null,
    })

    assert.isNull(reactivated.reactivationComment)
  })

  test('treats a whitespace-only comment as no comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('archived').create()

    const reactivated = await (await app.container.make(ReactivateTruckUseCase)).handle({
      id: truck.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '   ',
    })

    assert.isNull(reactivated.reactivationComment)
  })

  test('preserves attributes and archive context, and replaces a prior reactivation context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.merge({
      status: 'ARCHIVED',
      archivedAt: DateTime.fromISO('2026-08-19T09:00:00.000+00:00'),
      archiveComment: 'Second archival',
      reactivatedAt: DateTime.fromISO('2026-08-04T09:00:00.000+00:00'),
      reactivationComment: 'First reactivation',
    }).create()
    const registration = truck.registration
    const vehicleModel = truck.vehicleModel
    const capacityTonnes = truck.capacityTonnes.toString()
    const transportCompanyId = truck.transportCompanyId
    const archivedAt = truck.archivedAt
    const archiveComment = truck.archiveComment
    const reactivatedAt = DateTime.now()

    const reactivated = await (await app.container.make(ReactivateTruckUseCase)).handle({
      id: truck.id,
      reactivatedByUserId: actor.id,
      reactivatedAt,
      comment: 'Back in service',
    })

    assert.equal(reactivated.registration, registration)
    assert.equal(reactivated.vehicleModel, vehicleModel)
    assert.equal(reactivated.capacityTonnes.toString(), capacityTonnes)
    assert.equal(reactivated.transportCompanyId, transportCompanyId)
    assert.equal(reactivated.archivedAt?.toISO(), archivedAt?.toISO())
    assert.equal(reactivated.archiveComment, archiveComment)
    assert.equal(reactivated.reactivationComment, 'Back in service')
    assert.equal(reactivated.reactivatedAt?.toISO(), reactivatedAt.toISO())
  })

  test('rejects a missing truck', async ({ assert }) => {
    const useCase = await app.container.make(ReactivateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-0000-0000-000000000000',
          reactivatedByUserId: '00000000-0000-0000-0000-000000000001',
          reactivatedAt: DateTime.now(),
          comment: null,
        }),
      TruckNotFoundException,
    )
  })

  test('rejects reactivation of an already-available truck', async ({ assert }) => {
    const truck = await TruckFactory.create()
    const useCase = await app.container.make(ReactivateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          reactivatedByUserId: truck.id,
          reactivatedAt: DateTime.now(),
          comment: null,
        }),
      TruckAlreadyAvailableException,
    )
  })

  test('rejects reactivation when the transport company is archived, then succeeds once it is available', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const { truck, company } = await createArchivedTruckWithArchivedCompanyScenario()
    const useCase = await app.container.make(ReactivateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          reactivatedByUserId: actor.id,
          reactivatedAt: DateTime.now(),
          comment: null,
        }),
      TruckTransportCompanyArchivedException,
    )
    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')

    company.status = 'AVAILABLE'
    await company.save()

    const reactivated = await useCase.handle({
      id: truck.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: null,
    })
    assert.equal(reactivated.status, 'AVAILABLE')
  })

  test('refuses to reactivate a suspended truck and leaves it suspended', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ suspensionComment: 'In the workshop' })
      .create()

    await assert.rejects(
      () =>
        (async () =>
          (await app.container.make(ReactivateTruckUseCase)).handle({
            id: truck.id,
            reactivatedByUserId: actor.id,
            reactivatedAt: DateTime.now(),
            comment: null,
          }))(),
      SuspendedTruckReadOnlyException.message,
    )

    await truck.refresh()
    assert.equal(truck.status, 'SUSPENDED')
    assert.equal(truck.suspensionComment, 'In the workshop')
    assert.isNull(truck.reactivatedAt)
  })
})
