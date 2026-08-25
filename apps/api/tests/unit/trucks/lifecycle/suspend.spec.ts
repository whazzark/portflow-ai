import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import Truck from '#models/truck'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UsedChecker from '#site_references/shared/used_checker'
import {
  TruckAlreadySuspendedException,
  TruckArchivedCannotSuspendException,
  TruckNotFoundException,
} from '#trucks/shared/truck_exceptions'
import SuspendTruckUseCase from '#trucks/suspend/suspend_truck_use_case'

import {
  createReservedAndShiftedTruckScenario,
  createReservedTruckScenario,
} from '../../../support/trucks/lifecycle_fixtures.ts'

const suspend = async () => app.container.make(SuspendTruckUseCase)

test.group('SuspendTruckUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('suspends an available truck with lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()
    const suspendedAt = DateTime.fromISO('2026-08-25T09:00:00.000+02:00')

    const suspended = await (await suspend()).handle({
      id: truck.id,
      suspendedByUserId: actor.id,
      suspendedAt,
      comment: '  Gearbox failure, in the workshop  ',
    })

    assert.equal(suspended.status, 'SUSPENDED')
    assert.equal(suspended.suspensionComment, 'Gearbox failure, in the workshop')
    assert.equal(suspended.suspendedByUserId, actor.id)
    assert.equal(suspended.suspendedAt?.toISO(), suspendedAt.toISO())
  })

  test('suspends a truck without a comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()

    const suspended = await (await suspend()).handle({
      id: truck.id,
      suspendedByUserId: actor.id,
      suspendedAt: DateTime.now(),
      comment: null,
    })

    assert.isNull(suspended.suspensionComment)
    assert.isNotNull(suspended.suspendedAt)
  })

  test('treats a whitespace-only comment as no comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()

    const suspended = await (await suspend()).handle({
      id: truck.id,
      suspendedByUserId: actor.id,
      suspendedAt: DateTime.now(),
      comment: '   ',
    })

    assert.isNull(suspended.suspensionComment)
  })

  test('preserves identity, attributes, and earlier lifecycle context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('reactivated')
      .merge({
        archiveComment: 'Withdrawn pending fleet review',
        reactivationComment: 'Back in the active fleet',
      })
      .create()

    const suspended = await (await suspend()).handle({
      id: truck.id,
      suspendedByUserId: actor.id,
      suspendedAt: DateTime.now(),
      comment: 'Annual technical inspection',
    })

    assert.equal(suspended.id, truck.id)
    assert.equal(suspended.registration, truck.registration)
    assert.equal(suspended.vehicleModel, truck.vehicleModel)
    assert.equal(suspended.capacityTonnes.toString(), truck.capacityTonnes.toString())
    assert.equal(suspended.transportCompanyId, truck.transportCompanyId)
    assert.equal(suspended.archiveComment, 'Withdrawn pending fleet review')
    assert.equal(suspended.reactivationComment, 'Back in the active fleet')
    assert.isNotNull(suspended.archivedAt)
    assert.isNotNull(suspended.reactivatedAt)
  })

  test('replaces the previous suspension context on a later cycle', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ suspensionComment: 'First immobilisation' })
      .create()
    // The reverse transition belongs to #253, so the return to service is simulated directly.
    await Truck.query().where('id', truck.id).update({ status: 'AVAILABLE' })

    const suspended = await (await suspend()).handle({
      id: truck.id,
      suspendedByUserId: actor.id,
      suspendedAt: DateTime.now(),
      comment: 'Second immobilisation',
    })

    assert.equal(suspended.suspensionComment, 'Second immobilisation')
  })

  test('suspends a truck reserved by a planned or active discharge', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    // Archival consults this checker and refuses; suspension must not.
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))

    for (const status of ['PLANNED', 'ACTIVE'] as const) {
      const { truck, assignment } = await createReservedTruckScenario({ status })

      const suspended = await (await suspend()).handle({
        id: truck.id,
        suspendedByUserId: actor.id,
        suspendedAt: DateTime.now(),
        comment: 'Broke down mid-campaign',
      })

      assert.equal(suspended.status, 'SUSPENDED')
      await assignment.refresh()
      assert.isNull(assignment.releasedAt)
      assert.equal(assignment.truckId, truck.id)
    }
  })

  test('leaves an active shift assignment untouched', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))
    const { truck, assignment, shiftTruck } = await createReservedAndShiftedTruckScenario()

    const suspended = await (await suspend()).handle({
      id: truck.id,
      suspendedByUserId: actor.id,
      suspendedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(suspended.status, 'SUSPENDED')
    await shiftTruck.refresh()
    assert.equal(shiftTruck.truckId, truck.id)
    assert.isNull(shiftTruck.effectiveTo)
    await assignment.refresh()
    assert.isNull(assignment.releasedAt)
  })

  test('refuses an unknown truck', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()

    await assert.rejects(
      () =>
        (async () =>
          (await suspend()).handle({
            id: '00000000-0000-4000-8000-000000000000',
            suspendedByUserId: actor.id,
            suspendedAt: DateTime.now(),
            comment: null,
          }))(),
      TruckNotFoundException.message,
    )
  })

  test('refuses a truck that is already suspended and keeps its context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ suspensionComment: 'Original reason' })
      .create()

    await assert.rejects(
      () =>
        (async () =>
          (await suspend()).handle({
            id: truck.id,
            suspendedByUserId: actor.id,
            suspendedAt: DateTime.now(),
            comment: 'Overwriting reason',
          }))(),
      TruckAlreadySuspendedException.message,
    )

    await truck.refresh()
    assert.equal(truck.suspensionComment, 'Original reason')
  })

  test('refuses an archived truck and leaves it archived', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('archived').create()

    await assert.rejects(
      () =>
        (async () =>
          (await suspend()).handle({
            id: truck.id,
            suspendedByUserId: actor.id,
            suspendedAt: DateTime.now(),
            comment: null,
          }))(),
      TruckArchivedCannotSuspendException.message,
    )

    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
    assert.isNull(truck.suspendedAt)
  })

  test('records exactly one suspension for concurrent attempts', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()
    const useCase = await suspend()

    const outcomes = await Promise.allSettled([
      useCase.handle({
        id: truck.id,
        suspendedByUserId: actor.id,
        suspendedAt: DateTime.now(),
        comment: 'First',
      }),
      useCase.handle({
        id: truck.id,
        suspendedByUserId: actor.id,
        suspendedAt: DateTime.now(),
        comment: 'Second',
      }),
    ])

    assert.lengthOf(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      1,
    )
    await truck.refresh()
    assert.equal(truck.status, 'SUSPENDED')
    assert.isNotNull(truck.suspendedAt)
  })
})
