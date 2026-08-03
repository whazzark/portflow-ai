import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { UserFactory } from '#database/factories/user_factory'
import ListAvailableTrucksUseCase from '#trucks/available/list_available_trucks_use_case'
import ListTrucksUseCase from '#trucks/list/list_trucks_use_case'

const TRUCK_COUNT = 1_000
const QUERY_LIMIT = 4
const ACCEPTANCE_LIMIT_MS = 2_000

test.group('Truck consultation scale', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('lists 1,000 trucks deterministically with bounded company and actor loading', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.merge({ name: 'Scale Carrier' }).create()
    const actor = await UserFactory.apply('active').create()
    const timestamp = '2026-08-01 00:00:00'
    const rows = Array.from({ length: TRUCK_COUNT }, (_, index) => {
      const archived = index % 4 === 0
      const ordinal = TRUCK_COUNT - index

      return {
        id: randomUUID(),
        registration: `SCALE-${String(ordinal).padStart(4, '0')}`,
        vehicle_model: index % 3 === 0 ? null : `Model ${index % 10}`,
        capacity_tonnes: 10 + (index % 30) + 0.125,
        transport_company_id: company.id,
        status: archived ? 'ARCHIVED' : 'AVAILABLE',
        archived_at: archived ? timestamp : null,
        archived_by_user_id: archived ? actor.id : null,
        archive_comment: archived ? 'Scale archive' : null,
        reactivated_at: archived ? null : timestamp,
        reactivated_by_user_id: archived ? null : actor.id,
        reactivation_comment: archived ? null : 'Scale reactivation',
        created_at: timestamp,
        updated_at: timestamp,
      }
    })

    for (let offset = 0; offset < rows.length; offset += 100) {
      await db.table('trucks').multiInsert(rows.slice(offset, offset + 100))
    }

    const completeQueries: string[] = []
    const unsubscribeComplete = emitter.on('db:query', ({ method, sql }) => {
      if (method === 'select') {
        completeQueries.push(sql)
      }
    })
    const completeStartedAt = performance.now()
    const complete = await (await app.container.make(ListTrucksUseCase)).handle()
    const completeDuration = performance.now() - completeStartedAt
    unsubscribeComplete()

    const availableQueries: string[] = []
    const unsubscribeAvailable = emitter.on('db:query', ({ method, sql }) => {
      if (method === 'select') {
        availableQueries.push(sql)
      }
    })
    const availableStartedAt = performance.now()
    const available = await (await app.container.make(ListAvailableTrucksUseCase)).handle()
    const availableDuration = performance.now() - availableStartedAt
    unsubscribeAvailable()

    assert.lengthOf(complete, TRUCK_COUNT)
    assert.lengthOf(available, 750)
    assert.equal(complete[0].registration, 'SCALE-0001')
    assert.equal(complete.at(-1)?.registration, 'SCALE-1000')
    assert.isTrue(available.every((truck) => truck.status === 'AVAILABLE'))
    assert.isTrue(complete.every((truck) => truck.transportCompanyId === company.id))
    assert.isTrue(
      complete.every((truck) =>
        truck.status === 'ARCHIVED'
          ? truck.archivedBy.id === actor.id
          : truck.reactivatedBy.id === actor.id,
      ),
    )
    assert.isAtMost(completeQueries.length, QUERY_LIMIT)
    assert.isAtMost(availableQueries.length, QUERY_LIMIT)
    assert.isBelow(completeDuration, ACCEPTANCE_LIMIT_MS)
    assert.isBelow(availableDuration, ACCEPTANCE_LIMIT_MS)
  })
})
