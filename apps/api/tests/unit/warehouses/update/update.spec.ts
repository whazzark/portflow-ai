import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import type Warehouse from '#models/warehouse'
import type {
  UpdateWarehouseCommand,
  UpdateWarehouseResult,
} from '#warehouses/shared/repositories/warehouse_repository'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import {
  ArchivedWarehouseReadOnlyException,
  InvalidWarehouseFootprintException,
  WarehouseDoorsOutsideFootprintException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'
import UpdateWarehouseUseCase from '#warehouses/update/update_warehouse_use_case'

const TRIANGLE = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const WAREHOUSE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

type StubbedWarehouse = Pick<Warehouse, 'id' | 'name' | 'status'> & {
  footprintPoints: Array<{ latitude: number; longitude: number }>
  doors: Array<{ name: string; latitude: number; longitude: number }>
}

const availableWarehouse = (overrides: Partial<StubbedWarehouse> = {}): StubbedWarehouse => ({
  id: WAREHOUSE_ID,
  name: 'North Shed',
  status: 'AVAILABLE',
  footprintPoints: TRIANGLE,
  doors: [],
  ...overrides,
})

/** Records what the use case asks of persistence, so the tests can prove a refusal never reaches it. */
function stubRepository(input: {
  found?: StubbedWarehouse | null
  result?: UpdateWarehouseResult
}) {
  const commands: UpdateWarehouseCommand[] = []
  const found = input.found === undefined ? availableWarehouse() : input.found

  app.container.swap(
    WarehouseRepository,
    () =>
      ({
        findWithDoors: () => Promise.resolve(found),
        updateAvailable: (command: UpdateWarehouseCommand) => {
          commands.push(command)
          return Promise.resolve(
            input.result ?? { kind: 'UPDATED', warehouse: found as unknown as Warehouse },
          )
        },
      }) as unknown as WarehouseRepository,
  )

  return commands
}

test.group('Warehouse update use case', (group) => {
  group.each.teardown(() => app.container.restoreAll())

  test('passes a name-only correction through trimmed, with no footprint', async ({ assert }) => {
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, name: '  North Shed  ' })

    assert.lengthOf(commands, 1)
    assert.equal(commands[0].name, 'North Shed')
    assert.isUndefined(commands[0].points)
  })

  test('passes a footprint-only correction through in the submitted order, with no name', async ({
    assert,
  }) => {
    const reshaped = [...TRIANGLE].reverse()
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, points: reshaped })

    assert.lengthOf(commands, 1)
    assert.isUndefined(commands[0].name)
    assert.deepEqual(commands[0].points, reshaped)
  })

  test('carries both members when both are submitted', async ({ assert }) => {
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, name: 'Renamed', points: TRIANGLE })

    assert.equal(commands[0].name, 'Renamed')
    assert.deepEqual(commands[0].points, TRIANGLE)
  })

  test('never takes a status from its input', async ({ assert }) => {
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, name: 'Renamed' })

    assert.notProperty(commands[0], 'status')
  })

  test('refuses a crossing outline without reaching persistence', async ({ assert }) => {
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: WAREHOUSE_ID,
          points: [
            { latitude: 0, longitude: 0 },
            { latitude: 2, longitude: 2 },
            { latitude: 0, longitude: 2 },
            { latitude: 2, longitude: 0 },
          ],
        }),
      new InvalidWarehouseFootprintException().message,
    )
    assert.isEmpty(commands)
  })

  test('refuses a reshape excluding a door, naming it, without reaching persistence', async ({
    assert,
  }) => {
    const commands = stubRepository({
      found: availableWarehouse({
        doors: [
          { name: 'Far Door', latitude: 49.6, longitude: 0.6 },
          { name: 'Near Door', latitude: 49.4934, longitude: 0.1085 },
        ],
      }),
    })
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle({ id: WAREHOUSE_ID, points: TRIANGLE }),
      new WarehouseDoorsOutsideFootprintException(['Far Door']).message,
    )
    assert.isEmpty(commands)
  })

  test('refuses an unknown warehouse without reaching persistence', async ({ assert }) => {
    const commands = stubRepository({ found: null })
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle({ id: WAREHOUSE_ID, name: 'Renamed' }),
      new WarehouseNotFoundException().message,
    )
    assert.isEmpty(commands)
  })

  test('refuses an archived warehouse without reaching persistence', async ({ assert }) => {
    const commands = stubRepository({ found: availableWarehouse({ status: 'ARCHIVED' }) })
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle({ id: WAREHOUSE_ID, name: 'Renamed' }),
      new ArchivedWarehouseReadOnlyException().message,
    )
    assert.isEmpty(commands)
  })

  test('maps a warehouse archived between the read and the write', async ({ assert }) => {
    stubRepository({ result: { kind: 'ARCHIVED' } })
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle({ id: WAREHOUSE_ID, name: 'Renamed' }),
      new ArchivedWarehouseReadOnlyException().message,
    )
  })

  test('carries the containment rule into the write, naming the doors it excludes', async ({
    assert,
  }) => {
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, points: TRIANGLE })

    // The doors the repository will read inside the transaction are not the ones read before it,
    // so the rule — not its result — is what travels with the command.
    assert.isFunction(commands[0].excludedDoors)
    assert.deepEqual(
      commands[0].excludedDoors?.([
        { name: 'Far Door', latitude: 49.6, longitude: 0.6 },
        { name: 'Near Door', latitude: 49.4934, longitude: 0.1085 },
      ]),
      ['Far Door'],
    )
  })

  test('leaves the containment rule out of a name-only correction', async ({ assert }) => {
    const commands = stubRepository({})
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, name: 'Renamed' })

    assert.isUndefined(commands[0].excludedDoors)
  })

  test('maps a door left outside between the read and the write, naming it', async ({ assert }) => {
    stubRepository({ result: { kind: 'DOORS_OUTSIDE', doorNames: ['Late Door'] } })
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle({ id: WAREHOUSE_ID, points: TRIANGLE }),
      new WarehouseDoorsOutsideFootprintException(['Late Door']).message,
    )
  })

  test('keeps a door lying exactly on the resulting boundary', async ({ assert }) => {
    const commands = stubRepository({
      found: availableWarehouse({
        doors: [
          { name: 'Edge Door', latitude: TRIANGLE[0].latitude, longitude: TRIANGLE[0].longitude },
        ],
      }),
    })
    const useCase = await app.container.make(UpdateWarehouseUseCase)

    await useCase.handle({ id: WAREHOUSE_ID, points: TRIANGLE })

    assert.lengthOf(commands, 1)
  })
})

test.group('Warehouse update policy', () => {
  test('allows organization and operations administrators to update warehouses', async ({
    assert,
  }) => {
    const policy = new WarehousePolicy()

    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).makeStubbed()
      assert.isTrue(policy.update(user))
    }
  })

  test('denies every other role', async ({ assert }) => {
    const policy = new WarehousePolicy()

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).makeStubbed()
      assert.isFalse(policy.update(user))
    }
  })
})
