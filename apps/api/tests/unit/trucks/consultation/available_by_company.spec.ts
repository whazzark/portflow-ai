import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import LucidTruckRepository from '#trucks/shared/repositories/lucid_truck_repository'

// biome-ignore lint/security/noSecrets: test group name, not a secret
test.group('LucidTruckRepository.findCompanyIdsWithAvailableTrucks', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('returns exactly the requested companies that still provide an available truck', async ({
    assert,
  }) => {
    const withAvailable = await TransportCompanyFactory.create()
    await TruckFactory.merge({ transportCompanyId: withAvailable.id }).create()

    const withOnlyArchived = await TransportCompanyFactory.create()
    await TruckFactory.apply('archived').merge({ transportCompanyId: withOnlyArchived.id }).create()

    const withNoTruck = await TransportCompanyFactory.create()

    const repository = await app.container.make(LucidTruckRepository)
    const result = await repository.findCompanyIdsWithAvailableTrucks({
      transportCompanyIds: [withAvailable.id, withOnlyArchived.id, withNoTruck.id],
    })

    assert.isTrue(result.has(withAvailable.id))
    assert.isFalse(result.has(withOnlyArchived.id))
    assert.isFalse(result.has(withNoTruck.id))
    assert.equal(result.size, 1)
  })

  test('omits an unknown company id from the result', async ({ assert }) => {
    const repository = await app.container.make(LucidTruckRepository)
    const result = await repository.findCompanyIdsWithAvailableTrucks({
      transportCompanyIds: ['00000000-0000-4000-8000-000000000000'],
    })

    assert.equal(result.size, 0)
  })

  test('returns an empty set for an empty request without querying', async ({ assert }) => {
    const repository = await app.container.make(LucidTruckRepository)
    const result = await repository.findCompanyIdsWithAvailableTrucks({
      transportCompanyIds: [],
    })

    assert.equal(result.size, 0)
  })
})
