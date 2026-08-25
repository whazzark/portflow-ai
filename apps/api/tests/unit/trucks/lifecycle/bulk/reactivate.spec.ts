import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ReactivateTrucksUseCase from '#trucks/reactivate/reactivate_trucks_use_case'
import { createArchivedTruckWithArchivedCompanyScenario } from '../../../../support/trucks/lifecycle_fixtures.ts'

test.group('ReactivateTrucksUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates eligible trucks and reports blockers in request order', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const eligible = await TruckFactory.apply('archived').create()
    const alreadyAvailable = await TruckFactory.create()
    const { truck: blockedByCompany } = await createArchivedTruckWithArchivedCompanyScenario()

    const result = await (await app.container.make(ReactivateTrucksUseCase)).handle({
      ids: [
        eligible.id,
        alreadyAvailable.id,
        blockedByCompany.id,
        '00000000-0000-0000-0000-000000000000',
      ],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Winter fleet back in service  ',
    })

    assert.deepEqual(
      result.updatedTrucks.map((truck) => truck.id),
      [eligible.id],
    )
    assert.deepEqual(
      result.blockedTrucks.map((blocker) => [blocker.id, blocker.reason]),
      [
        [alreadyAvailable.id, 'ALREADY_AVAILABLE'],
        [blockedByCompany.id, 'TRANSPORT_COMPANY_ARCHIVED'],
        ['00000000-0000-0000-0000-000000000000', 'NOT_FOUND'],
      ],
    )
  })

  test('omits registration for a not-found blocker', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()

    const result = await (await app.container.make(ReactivateTrucksUseCase)).handle({
      ids: ['00000000-0000-0000-0000-000000000000'],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: null,
    })

    assert.deepEqual(result.blockedTrucks, [
      { id: '00000000-0000-0000-0000-000000000000', reason: 'NOT_FOUND' },
    ])
  })

  test('reactivates several trucks with a shared, normalized comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const trucks = await TruckFactory.apply('archived').createMany(2)

    const result = await (await app.container.make(ReactivateTrucksUseCase)).handle({
      ids: trucks.map((truck) => truck.id),
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Portfolio recall  ',
    })

    assert.deepEqual(
      result.updatedTrucks.map((truck) => truck.id),
      trucks.map((truck) => truck.id),
    )
    assert.isEmpty(result.blockedTrucks)
    assert.isTrue(
      result.updatedTrucks.every((truck) => truck.reactivationComment === 'Portfolio recall'),
    )
    const reactivatedAtValues = new Set(
      result.updatedTrucks.map((truck) => truck.reactivatedAt?.toISO()),
    )
    assert.equal(reactivatedAtValues.size, 1)
    assert.isTrue(result.updatedTrucks.every((truck) => truck.reactivatedByUserId === actor.id))
  })

  test('reactivates nothing when every submitted truck is ineligible', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const availableTrucks = await TruckFactory.createMany(2)

    const result = await (await app.container.make(ReactivateTrucksUseCase)).handle({
      ids: availableTrucks.map((truck) => truck.id),
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: null,
    })

    assert.isEmpty(result.updatedTrucks)
    assert.equal(result.blockedTrucks.length, 2)
    assert.isTrue(result.blockedTrucks.every((blocker) => blocker.reason === 'ALREADY_AVAILABLE'))
  })
})
