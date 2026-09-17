import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import LucidDischargeStartRepository from '#discharges/shared/repositories/lucid_discharge_start_repository'
import { startReferenceIds } from '#discharges/start/discharge_start_rules'

import { createStartableDischarge } from './start_scenario.ts'

const TABLE = /from [`"]?(\w+)[`"]?/i

/**
 * The references a start claims are read in the repository-wide lock order, so a start cannot
 * deadlock with a planning write or an archive that takes the same locks. SQLite drops the lock
 * clauses, so this proves the order of the statements; PostgreSQL adds the modes (quickstart).
 */
test.group('Discharge start claim order', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reads the dock, customers, users, trucks, warehouses, doors, then weighing areas', async ({
    assert,
  }) => {
    const { discharge } = await createStartableDischarge()
    const repository = new LucidDischargeStartRepository()
    const knex = db.connection().getWriteClient()
    const tables: string[] = []
    const listener = (query: { sql: string }) => {
      const table = TABLE.exec(query.sql)?.[1]
      if (table) {
        tables.push(table)
      }
    }

    await db.transaction(async (client) => {
      const plan = await repository.readStartPlan(discharge.id, client)
      knex.on('query', listener)
      try {
        await repository.readReferences(startReferenceIds(discharge.dockId, plan), 'CLAIM', client)
      } finally {
        knex.off('query', listener)
      }
    })

    assert.deepEqual(tables, [
      'docks',
      'customers',
      'users',
      'trucks',
      'warehouse_doors',
      'warehouses',
      'warehouse_doors',
      'weighing_areas',
    ])
  })
})
