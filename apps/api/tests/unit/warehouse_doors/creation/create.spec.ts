import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import type WarehouseDoor from '#models/warehouse_door'
import CreateWarehouseDoorUseCase from '#warehouse_doors/create/create_warehouse_door_use_case'
import type {
  CreateWarehouseDoorCommand,
  CreateWarehouseDoorResult,
} from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'

const TRIANGLE = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const INSIDE = { latitude: 49.4935, longitude: 0.1085 }

const validInput = (
  overrides: Partial<{ name: string; latitude: number; longitude: number }> = {},
) => ({
  warehouseId: '018f80c0-8799-7cb0-bb14-2d2c8d206a8c',
  name: 'Door 3',
  ...INSIDE,
  ...overrides,
})

/**
 * Captures the command the use case hands the repository, so the assertions can look at what
 * actually reaches persistence rather than at the returned door.
 */
function stubRepository(result: CreateWarehouseDoorResult) {
  const commands: CreateWarehouseDoorCommand[] = []

  app.container.swap(
    WarehouseDoorRepository,
    () =>
      ({
        create: (command: CreateWarehouseDoorCommand) => {
          commands.push(command)
          return Promise.resolve(result)
        },
      }) as unknown as WarehouseDoorRepository,
  )

  return commands
}

const createdResult = (door: Partial<WarehouseDoor> = {}) =>
  ({ kind: 'CREATED', door: { id: 'door-id', ...door } }) as CreateWarehouseDoorResult

test.group('CreateWarehouseDoorUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(WarehouseDoorRepository))

  test('hands the repository a trimmed name', async ({ assert }) => {
    const commands = stubRepository(createdResult())

    await (await app.container.make(CreateWarehouseDoorUseCase)).handle(
      validInput({ name: '  Door 3  ' }),
    )

    assert.equal(commands[0].name, 'Door 3')
  })

  test('passes the submitted coordinates through untouched', async ({ assert }) => {
    const commands = stubRepository(createdResult())

    await (await app.container.make(CreateWarehouseDoorUseCase)).handle(validInput())

    assert.equal(commands[0].latitude, INSIDE.latitude)
    assert.equal(commands[0].longitude, INSIDE.longitude)
  })

  test('accepts a position inside or on the footprint and refuses one outside', async ({
    assert,
  }) => {
    const commands = stubRepository(createdResult())

    await (await app.container.make(CreateWarehouseDoorUseCase)).handle(validInput())

    const { contains } = commands[0]
    assert.isTrue(contains(TRIANGLE))

    const outsideCommands = stubRepository(createdResult())
    await (await app.container.make(CreateWarehouseDoorUseCase)).handle(
      validInput({ latitude: 49.49, longitude: 0.1085 }),
    )

    assert.isFalse(outsideCommands[0].contains(TRIANGLE))
  })

  test('returns the created door', async ({ assert }) => {
    stubRepository(createdResult({ name: 'Door 3' } as Partial<WarehouseDoor>))

    const door = await (await app.container.make(CreateWarehouseDoorUseCase)).handle(validInput())

    assert.equal(door.name, 'Door 3')
  })
})

test.group('CreateWarehouseDoorUseCase — refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(WarehouseDoorRepository))

  test('refuses a name that is blank once trimmed', async ({ assert }) => {
    stubRepository(createdResult())

    await assert.rejects(
      async () =>
        (await app.container.make(CreateWarehouseDoorUseCase)).handle(validInput({ name: '   ' })),
      /must not be empty/,
    )
  })

  test('refuses a name longer than the site-reference limit', async ({ assert }) => {
    stubRepository(createdResult())

    await assert.rejects(
      async () =>
        (await app.container.make(CreateWarehouseDoorUseCase)).handle(
          validInput({ name: 'D'.repeat(256) }),
        ),
      /must not be empty/,
    )
  })

  test('refuses a coordinate outside its legal range', async ({ assert }) => {
    stubRepository(createdResult())

    await assert.rejects(
      async () =>
        (await app.container.make(CreateWarehouseDoorUseCase)).handle(validInput({ latitude: 91 })),
      /out of range/,
    )
  })

  test('maps every repository refusal to its own exception', async ({ assert }) => {
    const expectations = [
      ['WAREHOUSE_NOT_FOUND', /Warehouse not found/],
      ['WAREHOUSE_ARCHIVED', /read-only/],
      ['OUTSIDE_FOOTPRINT', /within its warehouse footprint/],
      ['DUPLICATE_NAME', /already in use/],
    ] as const

    for (const [kind, message] of expectations) {
      stubRepository({ kind } as CreateWarehouseDoorResult)

      await assert.rejects(
        async () => (await app.container.make(CreateWarehouseDoorUseCase)).handle(validInput()),
        message,
      )
    }
  })
})
