import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type WarehouseDoor from '#models/warehouse_door'
import ArchiveWarehouseDoorUseCase from '#warehouse_doors/archive/archive_warehouse_door_use_case'
import type {
  ArchiveWarehouseDoorCommand,
  ArchiveWarehouseDoorResult,
} from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import {
  WarehouseDoorAlreadyArchivedException,
  WarehouseDoorInUseException,
  WarehouseDoorNotFoundException,
} from '#warehouse_doors/shared/warehouse_door_exceptions'
import {
  ArchivedWarehouseReadOnlyException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

const DOOR_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f11'
const ACTOR_ID = '018f7f21-5d0e-7a55-9d0e-2c9a3f5b1a44'
const ARCHIVED_AT = DateTime.fromISO('2026-08-27T14:03:07.000+02:00')

/**
 * Captures the command the use case hands the repository, so the assertions look at what actually
 * reaches persistence rather than at the returned door.
 */
function stubRepository(result: ArchiveWarehouseDoorResult) {
  const commands: ArchiveWarehouseDoorCommand[] = []

  app.container.swap(
    WarehouseDoorRepository,
    () =>
      ({
        archiveAvailable: (command: ArchiveWarehouseDoorCommand) => {
          commands.push(command)
          return Promise.resolve(result)
        },
      }) as unknown as WarehouseDoorRepository,
  )

  return commands
}

const archivedResult = () =>
  ({ kind: 'ARCHIVED', door: { id: DOOR_ID } }) as ArchiveWarehouseDoorResult

const handle = async (input: Parameters<ArchiveWarehouseDoorUseCase['handle']>[0]) =>
  (await app.container.make(ArchiveWarehouseDoorUseCase)).handle(input)

const input = (comment?: string | null) => ({
  id: DOOR_ID,
  archivedByUserId: ACTOR_ID,
  archivedAt: ARCHIVED_AT,
  comment,
})

test.group('ArchiveWarehouseDoorUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(WarehouseDoorRepository))

  test('hands the repository a trimmed comment', async ({ assert }) => {
    const commands = stubRepository(archivedResult())

    await handle(input('  Walled up  '))

    assert.equal(commands[0].archiveComment, 'Walled up')
  })

  test('records no comment for an absent, empty, or whitespace-only one', async ({ assert }) => {
    for (const supplied of [undefined, null, '', '   ']) {
      const commands = stubRepository(archivedResult())

      await handle(input(supplied))

      assert.isNull(commands[0].archiveComment)
      app.container.restore(WarehouseDoorRepository)
    }
  })

  test('passes the submission time and the responsible administrator through', async ({
    assert,
  }) => {
    const commands = stubRepository(archivedResult())

    await handle(input())

    assert.equal(commands[0].id, DOOR_ID)
    assert.equal(commands[0].archivedByUserId, ACTOR_ID)
    assert.equal(commands[0].archivedAt.toISO(), ARCHIVED_AT.toISO())
  })

  test('returns the archived door', async ({ assert }) => {
    stubRepository(archivedResult())

    const door = (await handle(input())) as WarehouseDoor

    assert.equal(door.id, DOOR_ID)
  })

  test('maps every refusal arm to its own exception', async ({ assert }) => {
    const cases = [
      { kind: 'DOOR_NOT_FOUND', exception: WarehouseDoorNotFoundException },
      { kind: 'ALREADY_ARCHIVED', exception: WarehouseDoorAlreadyArchivedException },
      { kind: 'IN_USE', exception: WarehouseDoorInUseException },
      { kind: 'WAREHOUSE_NOT_FOUND', exception: WarehouseNotFoundException },
      { kind: 'WAREHOUSE_ARCHIVED', exception: ArchivedWarehouseReadOnlyException },
    ] as const

    for (const { kind, exception } of cases) {
      stubRepository({ kind } as ArchiveWarehouseDoorResult)

      await assert.rejects(() => handle(input()), exception.message)
      app.container.restore(WarehouseDoorRepository)
    }
  })
})
