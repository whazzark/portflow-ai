import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import type WarehouseDoor from '#models/warehouse_door'
import type {
  UpdateWarehouseDoorCommand,
  UpdateWarehouseDoorResult,
} from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import UpdateWarehouseDoorUseCase from '#warehouse_doors/update/update_warehouse_door_use_case'

const TRIANGLE = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const INSIDE = { latitude: 49.4935, longitude: 0.1085 }
const OUTSIDE = { latitude: 49.49, longitude: 0.1085 }

const DOOR_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f11'

/**
 * Captures the command the use case hands the repository, so the assertions can look at what
 * actually reaches persistence rather than at the returned door.
 */
function stubRepository(result: UpdateWarehouseDoorResult) {
  const commands: UpdateWarehouseDoorCommand[] = []

  app.container.swap(
    WarehouseDoorRepository,
    () =>
      ({
        updateAvailable: (command: UpdateWarehouseDoorCommand) => {
          commands.push(command)
          return Promise.resolve(result)
        },
      }) as unknown as WarehouseDoorRepository,
  )

  return commands
}

const updatedResult = (door: Partial<WarehouseDoor> = {}) =>
  ({ kind: 'UPDATED', door: { id: DOOR_ID, ...door } }) as UpdateWarehouseDoorResult

const handle = async (input: Parameters<UpdateWarehouseDoorUseCase['handle']>[0]) =>
  (await app.container.make(UpdateWarehouseDoorUseCase)).handle(input)

test.group('UpdateWarehouseDoorUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(WarehouseDoorRepository))

  test('hands the repository a trimmed name', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await handle({ id: DOOR_ID, name: '  Door 4  ' })

    assert.equal(commands[0].name, 'Door 4')
  })

  test('passes the submitted coordinates through untouched', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await handle({ id: DOOR_ID, ...INSIDE })

    assert.equal(commands[0].latitude, INSIDE.latitude)
    assert.equal(commands[0].longitude, INSIDE.longitude)
  })

  test('omits an absent name and absent coordinates from the command', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await handle({ id: DOOR_ID, name: 'Door 4' })

    assert.isFalse('latitude' in commands[0])
    assert.isFalse('longitude' in commands[0])

    const positionOnly = stubRepository(updatedResult())
    await handle({ id: DOOR_ID, ...INSIDE })

    assert.isFalse('name' in positionOnly[0])
  })

  test('supplies a containment predicate when a position is submitted', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await handle({ id: DOOR_ID, ...INSIDE })

    assert.isFunction(commands[0].contains)
    assert.isTrue(commands[0].contains?.(TRIANGLE))
  })

  test('rejects a submitted position the containing footprint does not enclose', async ({
    assert,
  }) => {
    const commands = stubRepository(updatedResult())

    await handle({ id: DOOR_ID, ...OUTSIDE })

    assert.isFalse(commands[0].contains?.(TRIANGLE))
  })

  test('supplies no containment predicate on a name-only update', async ({ assert }) => {
    // A stored door is already inside its warehouse, and #209 refuses any reshape that would leave
    // it outside — so a rename has nothing to answer for, and running the check could only refuse a
    // legitimate correction for a violation this slice did not cause.
    const commands = stubRepository(updatedResult())

    await handle({ id: DOOR_ID, name: 'Door 4' })

    assert.isUndefined(commands[0].contains)
  })

  test('never lets the caller re-parent the door or choose its lifecycle state', async ({
    assert,
  }) => {
    const commands = stubRepository(updatedResult())

    await handle({
      id: DOOR_ID,
      name: 'Door 4',
      ...({ warehouseId: 'another-warehouse', status: 'ARCHIVED' } as object),
    })

    assert.isFalse('warehouseId' in commands[0])
    assert.isFalse('status' in commands[0])
  })

  test('returns the updated door on success', async ({ assert }) => {
    stubRepository(updatedResult({ name: 'Door 4' }))

    const door = await handle({ id: DOOR_ID, name: 'Door 4' })

    assert.equal(door.id, DOOR_ID)
    assert.equal(door.name, 'Door 4')
  })

  test('rejects a blank name without reaching the repository', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await assert.rejects(
      () => handle({ id: DOOR_ID, name: '   ' }),
      /Warehouse door name must not be empty/,
    )
    assert.isEmpty(commands)
  })

  test('rejects a name longer than the site-reference limit', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await assert.rejects(
      () => handle({ id: DOOR_ID, name: 'a'.repeat(256) }),
      /Warehouse door name must not be empty/,
    )
    assert.isEmpty(commands)
  })

  test('rejects an out-of-range or non-finite coordinate', async ({ assert }) => {
    const commands = stubRepository(updatedResult())

    await assert.rejects(
      () => handle({ id: DOOR_ID, latitude: 91, longitude: 0 }),
      /Warehouse door coordinates are out of range/,
    )
    await assert.rejects(
      () => handle({ id: DOOR_ID, latitude: 0, longitude: Number.NaN }),
      /Warehouse door coordinates are out of range/,
    )
    assert.isEmpty(commands)
  })

  test('maps every repository refusal to its own exception', async ({ assert }) => {
    const refusals = [
      { kind: 'DOOR_NOT_FOUND', message: /Warehouse door not found/ },
      { kind: 'DOOR_ARCHIVED', message: /Archived warehouse doors are read-only/ },
      { kind: 'WAREHOUSE_NOT_FOUND', message: /Warehouse not found/ },
      { kind: 'WAREHOUSE_ARCHIVED', message: /Archived warehouses are read-only/ },
      { kind: 'OUTSIDE_FOOTPRINT', message: /within its warehouse footprint/ },
      { kind: 'DUPLICATE_NAME', message: /already in use in this warehouse/ },
    ] as const

    for (const refusal of refusals) {
      stubRepository({ kind: refusal.kind } as UpdateWarehouseDoorResult)

      await assert.rejects(() => handle({ id: DOOR_ID, name: 'Door 4' }), refusal.message)
    }
  })
})
