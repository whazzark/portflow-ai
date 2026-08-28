import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ReactivateWarehouseDoorUseCase from '#warehouse_doors/reactivate/reactivate_warehouse_door_use_case'
import type {
  ReactivateWarehouseDoorCommand,
  ReactivateWarehouseDoorResult,
} from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import {
  WarehouseDoorAlreadyAvailableException,
  WarehouseDoorArchivedWithWarehouseException,
  WarehouseDoorNotFoundException,
} from '#warehouse_doors/shared/warehouse_door_exceptions'
import { WarehouseNotFoundException } from '#warehouses/shared/warehouse_exceptions'

const REACTIVATED_AT = DateTime.fromISO('2026-08-27T10:00:00.000+02:00')
const ACTOR = '018f80c0-8799-7cb0-bb14-2d2c8d206a8c'
const DOOR_ID = '018f80c0-8799-7cb0-bb14-2d2c8d206a8d'

const reactivatedResult = () =>
  ({ kind: 'REACTIVATED', door: { id: DOOR_ID } }) as ReactivateWarehouseDoorResult

/**
 * Captures the command the use case hands the repository, so the assertions look at what actually
 * reaches persistence rather than at the returned door.
 */
function stubRepository(result: ReactivateWarehouseDoorResult) {
  const commands: ReactivateWarehouseDoorCommand[] = []

  app.container.swap(
    WarehouseDoorRepository,
    () =>
      ({
        reactivateArchived: (command: ReactivateWarehouseDoorCommand) => {
          commands.push(command)
          return Promise.resolve(result)
        },
      }) as unknown as WarehouseDoorRepository,
  )

  return commands
}

const handle = (comment?: string | null) =>
  app.container.make(ReactivateWarehouseDoorUseCase).then((useCase) =>
    useCase.handle({
      id: DOOR_ID,
      reactivatedByUserId: ACTOR,
      reactivatedAt: REACTIVATED_AT,
      comment,
    }),
  )

test.group('ReactivateWarehouseDoorUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(WarehouseDoorRepository))

  test('passes the actor and the time through untouched', async ({ assert }) => {
    const commands = stubRepository(reactivatedResult())

    await handle('Back in service')

    assert.lengthOf(commands, 1)
    assert.equal(commands[0].id, DOOR_ID)
    assert.equal(commands[0].reactivatedByUserId, ACTOR)
    assert.equal(commands[0].reactivatedAt.toMillis(), REACTIVATED_AT.toMillis())
  })

  test('trims the comment before it reaches persistence', async ({ assert }) => {
    const commands = stubRepository(reactivatedResult())

    await handle('  Back in service  ')

    assert.equal(commands[0].reactivationComment, 'Back in service')
  })

  test('records no comment for absent, empty, and whitespace-only values', async ({ assert }) => {
    for (const comment of [undefined, null, '', '   ']) {
      const commands = stubRepository(reactivatedResult())

      await handle(comment)

      assert.isNull(commands[0].reactivationComment)
      app.container.restore(WarehouseDoorRepository)
    }
  })

  test('maps DOOR_NOT_FOUND to the door not-found exception', async ({ assert }) => {
    stubRepository({ kind: 'DOOR_NOT_FOUND' })

    await assert.rejects(() => handle(), WarehouseDoorNotFoundException.message)
  })

  test('maps ALREADY_AVAILABLE to the already-available exception', async ({ assert }) => {
    stubRepository({ kind: 'ALREADY_AVAILABLE' })

    await assert.rejects(() => handle(), WarehouseDoorAlreadyAvailableException.message)
  })

  // The door's own exception rather than the warehouse's read-only refusal: an archived warehouse
  // holds no door but those archived with it, so the remedy is one step, not two.
  test('maps WAREHOUSE_ARCHIVED to the archived-with-warehouse exception', async ({ assert }) => {
    stubRepository({ kind: 'WAREHOUSE_ARCHIVED' })

    await assert.rejects(() => handle(), WarehouseDoorArchivedWithWarehouseException.message)
  })

  test('reuses the warehouse exception when the warehouse is the missing one', async ({
    assert,
  }) => {
    stubRepository({ kind: 'WAREHOUSE_NOT_FOUND' })

    await assert.rejects(() => handle(), WarehouseNotFoundException.message)
  })
})
