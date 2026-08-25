import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import Truck from '#models/truck'
import ReturnTruckToServiceUseCase from '#trucks/return_to_service/return_truck_to_service_use_case'
import {
  TruckAlreadyAvailableException,
  TruckArchivedCannotReturnException,
  TruckNotFoundException,
  TruckTransportCompanyArchivedException,
} from '#trucks/shared/truck_exceptions'

import {
  createReservedAndShiftedTruckScenario,
  createSuspendedTruckWithArchivedCompanyScenario,
} from '../../../support/trucks/lifecycle_fixtures.ts'

const returnToService = async () => app.container.make(ReturnTruckToServiceUseCase)

// biome-ignore lint/security/noSecrets: use-case name, not a secret
test.group('ReturnTruckToServiceUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('returns a suspended truck to service with lifecycle metadata', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended').create()
    const returnedToServiceAt = DateTime.fromISO('2026-08-25T09:00:00.000+02:00')

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt,
      comment: '  Gearbox replaced, roadworthy  ',
    })

    assert.equal(returned.status, 'AVAILABLE')
    assert.equal(returned.returnToServiceComment, 'Gearbox replaced, roadworthy')
    assert.equal(returned.returnedToServiceByUserId, actor.id)
    assert.equal(returned.returnedToServiceAt?.toISO(), returnedToServiceAt.toISO())
  })

  test('returns a truck without a comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended').create()

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: null,
    })

    assert.isNull(returned.returnToServiceComment)
    assert.isNotNull(returned.returnedToServiceAt)
  })

  test('treats a whitespace-only comment as no comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended').create()

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: '   ',
    })

    assert.isNull(returned.returnToServiceComment)
  })

  test('keeps the suspension it ends readable as history', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const suspendingAdmin = await UserFactory.apply('active').create()
    const suspendedAt = DateTime.fromISO('2026-08-20T07:02:00.000+02:00')
    const truck = await TruckFactory.apply('suspended')
      .merge({
        suspendedAt,
        suspendedByUserId: suspendingAdmin.id,
        suspensionComment: 'Gearbox failure, awaiting workshop slot',
      })
      .create()

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: 'Repaired',
    })

    assert.equal(returned.suspendedAt?.toISO(), suspendedAt.toISO())
    assert.equal(returned.suspendedByUserId, suspendingAdmin.id)
    assert.equal(returned.suspensionComment, 'Gearbox failure, awaiting workshop slot')
  })

  test('preserves identity, attributes, and earlier archive context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({
        archivedAt: DateTime.now().minus({ days: 200 }),
        archiveComment: 'Withdrawn pending fleet review',
        reactivatedAt: DateTime.now().minus({ days: 150 }),
        reactivationComment: 'Back in the active fleet',
      })
      .create()

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: null,
    })

    assert.equal(returned.id, truck.id)
    assert.equal(returned.registration, truck.registration)
    assert.equal(returned.vehicleModel, truck.vehicleModel)
    assert.equal(returned.capacityTonnes.toString(), truck.capacityTonnes.toString())
    assert.equal(returned.transportCompanyId, truck.transportCompanyId)
    assert.equal(returned.archiveComment, 'Withdrawn pending fleet review')
    assert.equal(returned.reactivationComment, 'Back in the active fleet')
    assert.isNotNull(returned.archivedAt)
    assert.isNotNull(returned.reactivatedAt)
  })

  test('keeps the latest suspension beside the return that preceded it', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ suspensionComment: 'First immobilisation' })
      .create()

    await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now().minus({ days: 2 }),
      comment: 'First repair',
    })

    // A second cycle: the suspension context is replaced, the earlier return is not.
    await truck.refresh()
    truck.status = 'SUSPENDED'
    truck.suspendedAt = DateTime.now().minus({ days: 1 })
    truck.suspensionComment = 'Second immobilisation'
    await truck.save()

    await truck.refresh()
    assert.equal(truck.suspensionComment, 'Second immobilisation')
    assert.equal(truck.returnToServiceComment, 'First repair')
  })

  // --- User Story 2: resume operational use without rewriting past work ---

  test('keeps the registration reserved throughout, with no duplicate vehicle', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended').create()

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: null,
    })

    assert.equal(returned.id, truck.id)
    assert.equal(returned.registration, truck.registration)
    // biome-ignore lint/security/noSecrets: SQL expression, not a secret
    const matching = await Truck.query().whereRaw('LOWER(registration) = ?', [
      truck.registration.toLowerCase(),
    ])
    assert.lengthOf(matching, 1)
  })

  test('leaves the shift assignment it kept while suspended untouched', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const { truck, assignment, shiftTruck } = await createReservedAndShiftedTruckScenario()
    await Truck.query()
      .where('id', truck.id)
      .update({ status: 'SUSPENDED', suspendedAt: DateTime.now().toSQL({ includeOffset: false }) })

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: null,
    })

    assert.equal(returned.status, 'AVAILABLE')
    await shiftTruck.refresh()
    assert.equal(shiftTruck.truckId, truck.id)
    assert.isNull(shiftTruck.effectiveTo)
    await assignment.refresh()
    assert.isNull(assignment.releasedAt)
    assert.equal(assignment.truckId, truck.id)
  })

  // --- User Story 3: authorization and lifecycle consistency ---

  test('refuses an unknown truck', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()

    await assert.rejects(
      () =>
        (async () =>
          (await returnToService()).handle({
            id: '00000000-0000-4000-8000-000000000000',
            returnedToServiceByUserId: actor.id,
            returnedToServiceAt: DateTime.now(),
            comment: null,
          }))(),
      TruckNotFoundException.message,
    )
  })

  test('refuses a truck that is already available', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.create()

    await assert.rejects(
      () =>
        (async () =>
          (await returnToService()).handle({
            id: truck.id,
            returnedToServiceByUserId: actor.id,
            returnedToServiceAt: DateTime.now(),
            comment: 'Already back',
          }))(),
      TruckAlreadyAvailableException.message,
    )

    await truck.refresh()
    assert.isNull(truck.returnedToServiceAt)
    assert.isNull(truck.returnToServiceComment)
  })

  test('refuses an archived truck and leaves it archived', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('archived').create()

    await assert.rejects(
      () =>
        (async () =>
          (await returnToService()).handle({
            id: truck.id,
            returnedToServiceByUserId: actor.id,
            returnedToServiceAt: DateTime.now(),
            comment: null,
          }))(),
      TruckArchivedCannotReturnException.message,
    )

    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
    assert.isNull(truck.returnedToServiceAt)
  })

  /**
   * The one rule in this slice that is not suspension read backwards. A suspended truck is not
   * counted as an available truck, so its transport company can legitimately have been archived
   * while the vehicle was out of service — and this is the only path that could then produce an
   * available truck under an archived company.
   */
  test('refuses a truck whose transport company is archived, and succeeds once it is reactivated', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const { truck, company } = await createSuspendedTruckWithArchivedCompanyScenario()

    await assert.rejects(
      () =>
        (async () =>
          (await returnToService()).handle({
            id: truck.id,
            returnedToServiceByUserId: actor.id,
            returnedToServiceAt: DateTime.now(),
            comment: null,
          }))(),
      TruckTransportCompanyArchivedException.message,
    )

    await truck.refresh()
    assert.equal(truck.status, 'SUSPENDED')
    assert.isNull(truck.returnedToServiceAt)

    company.status = 'AVAILABLE'
    await company.save()

    const returned = await (await returnToService()).handle({
      id: truck.id,
      returnedToServiceByUserId: actor.id,
      returnedToServiceAt: DateTime.now(),
      comment: 'Company reactivated',
    })

    assert.equal(returned.status, 'AVAILABLE')
  })

  test('refuses a suspended truck whose company was archived after the truck was read', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.apply('suspended')
      .merge({ transportCompanyId: company.id })
      .create()

    // The state is assessed when the return is submitted, not when the truck was opened.
    company.status = 'ARCHIVED'
    company.archivedAt = DateTime.now()
    await company.save()

    await assert.rejects(
      () =>
        (async () =>
          (await returnToService()).handle({
            id: truck.id,
            returnedToServiceByUserId: actor.id,
            returnedToServiceAt: DateTime.now(),
            comment: null,
          }))(),
      TruckTransportCompanyArchivedException.message,
    )
  })

  // --- User Story 4: refusals and recovery ---

  test('records exactly one return for concurrent attempts', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const truck = await TruckFactory.apply('suspended').create()
    const useCase = await returnToService()

    const outcomes = await Promise.allSettled([
      useCase.handle({
        id: truck.id,
        returnedToServiceByUserId: actor.id,
        returnedToServiceAt: DateTime.now(),
        comment: 'First',
      }),
      useCase.handle({
        id: truck.id,
        returnedToServiceByUserId: actor.id,
        returnedToServiceAt: DateTime.now(),
        comment: 'Second',
      }),
    ])

    assert.lengthOf(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      1,
    )
    // The loser is told the truck is already available, not that it vanished.
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
    assert.equal(
      (rejected as PromiseRejectedResult).reason.message,
      TruckAlreadyAvailableException.message,
    )
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
    assert.isNotNull(truck.returnedToServiceAt)
  })

  test('leaves the stored row untouched when the return is refused', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const { truck } = await createSuspendedTruckWithArchivedCompanyScenario()
    await truck.refresh()
    const before = truck.toJSON()

    await assert.rejects(
      () =>
        (async () =>
          (await returnToService()).handle({
            id: truck.id,
            returnedToServiceByUserId: actor.id,
            returnedToServiceAt: DateTime.now(),
            comment: 'Should not be stored',
          }))(),
      TruckTransportCompanyArchivedException.message,
    )

    await truck.refresh()
    assert.deepEqual(truck.toJSON(), before)
  })
})
