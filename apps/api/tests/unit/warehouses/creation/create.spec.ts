import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import type Warehouse from '#models/warehouse'
import CreateWarehouseUseCase from '#warehouses/create/create_warehouse_use_case'
import type {
  CreateWarehouseCommand,
  CreateWarehouseResult,
} from '#warehouses/shared/repositories/warehouse_repository'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import {
  DuplicateWarehouseNameException,
  InvalidWarehouseFootprintException,
  InvalidWarehouseNameException,
} from '#warehouses/shared/warehouse_exceptions'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'

const TRIANGLE = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

function stubRepository(result: CreateWarehouseResult) {
  const commands: CreateWarehouseCommand[] = []

  app.container.swap(
    WarehouseRepository,
    () =>
      ({
        create: (command: CreateWarehouseCommand) => {
          commands.push(command)
          return Promise.resolve(result)
        },
      }) as unknown as WarehouseRepository,
  )

  return commands
}

test.group('Warehouse creation policy', () => {
  test('allows organization and operations administrators to create warehouses', async ({
    assert,
  }) => {
    const policy = new WarehousePolicy()

    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isTrue(policy.create(user))
    }
  })

  test('rejects roles without warehouse management permission', async ({ assert }) => {
    const policy = new WarehousePolicy()

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).make()
      assert.isFalse(policy.create(user))
    }
  })
})

test.group('Create warehouse use case', (group) => {
  group.each.teardown(() => app.container.restore(WarehouseRepository))

  test('trims the name and forwards the footprint order untouched', async ({ assert }) => {
    const commands = stubRepository({
      kind: 'CREATED',
      warehouse: { id: 'created' } as unknown as Warehouse,
    })

    const useCase = await app.container.make(CreateWarehouseUseCase)
    await useCase.handle({ name: '  North Shed  ', points: TRIANGLE })

    assert.lengthOf(commands, 1)
    assert.equal(commands[0].name, 'North Shed')
    assert.deepEqual(commands[0].points, TRIANGLE)
  })

  test('never lets the caller choose a status', async ({ assert }) => {
    const commands = stubRepository({
      kind: 'CREATED',
      warehouse: { id: 'created' } as unknown as Warehouse,
    })

    const useCase = await app.container.make(CreateWarehouseUseCase)
    await useCase.handle({
      name: 'North Shed',
      points: TRIANGLE,
      status: 'ARCHIVED',
    } as unknown as { name: string; points: typeof TRIANGLE })

    assert.notProperty(commands[0], 'status')
  })

  test('raises a conflict when the repository reports a duplicate name', async ({ assert }) => {
    stubRepository({ kind: 'DUPLICATE_NAME' })

    const useCase = await app.container.make(CreateWarehouseUseCase)
    await assert.rejects(
      () => useCase.handle({ name: 'North Shed', points: TRIANGLE }),
      new DuplicateWarehouseNameException().message,
    )
  })

  test('rejects a self-crossing outline before reaching persistence', async ({ assert }) => {
    const commands = stubRepository({
      kind: 'CREATED',
      warehouse: { id: 'created' } as unknown as Warehouse,
    })

    const useCase = await app.container.make(CreateWarehouseUseCase)
    await assert.rejects(
      () =>
        useCase.handle({
          name: 'Bow Tie',
          points: [
            { latitude: 0, longitude: 0 },
            { latitude: 2, longitude: 2 },
            { latitude: 0, longitude: 2 },
            { latitude: 2, longitude: 0 },
          ],
        }),
      new InvalidWarehouseFootprintException().message,
    )
    assert.lengthOf(commands, 0)
  })

  test('rejects an illegal coordinate in warehouse terms, before reaching persistence', async ({
    assert,
  }) => {
    const commands = stubRepository({
      kind: 'CREATED',
      warehouse: { id: 'created' } as unknown as Warehouse,
    })

    const useCase = await app.container.make(CreateWarehouseUseCase)
    // The rule is shared with every site reference, the error code is not: an administrator on the
    // warehouse form must never be shown an `E_SITE_REFERENCE_*` failure.
    await assert.rejects(
      () =>
        useCase.handle({
          name: 'Off World',
          points: [{ latitude: 91, longitude: 0 }, ...TRIANGLE.slice(1)],
        }),
      'Warehouse footprint coordinates are out of range',
    )
    assert.lengthOf(commands, 0)
  })

  test('rejects a blank name in warehouse terms', async ({ assert }) => {
    const commands = stubRepository({
      kind: 'CREATED',
      warehouse: { id: 'created' } as unknown as Warehouse,
    })

    const useCase = await app.container.make(CreateWarehouseUseCase)
    await assert.rejects(
      () => useCase.handle({ name: '   ', points: TRIANGLE }),
      new InvalidWarehouseNameException().message,
    )
    assert.lengthOf(commands, 0)
  })
})
