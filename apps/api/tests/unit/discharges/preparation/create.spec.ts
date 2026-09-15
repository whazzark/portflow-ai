import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'

import CreatePlannedDischargeUseCase, {
  type CreatePlannedDischargeInput,
} from '#discharges/create/create_planned_discharge_use_case'
import type {
  CreatePlannedDischargeCommand,
  CreatePlannedDischargeResult,
} from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import type Discharge from '#models/discharge'

const DOCK_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'
const RESPONSIBLE_ID = '33333333-3333-4333-8333-333333333333'
const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'

type LockedRows = Record<string, object | undefined>

type StubOptions = {
  existingId?: string | null
  result?: CreatePlannedDischargeResult
  /** Rows found under lock, by identity; an identity absent from the record is not found. */
  docks?: LockedRows
  customers?: LockedRows
  users?: LockedRows
}

/**
 * A repository that records what the use case asks of it, in order. Unless a test says otherwise,
 * every reference it is asked to lock exists and is available or eligible.
 */
function stubRepositories({
  existingId = null,
  result = { kind: 'CREATED' },
  docks,
  customers,
  users,
}: StubOptions = {}) {
  const calls: string[] = []
  const commands: CreatePlannedDischargeCommand[] = []
  const detail = { id: DISCHARGE_ID } as Discharge
  const lock =
    (name: string, rows: LockedRows | undefined, available: object) => (ids: string[]) => {
      calls.push(`${name}:${ids.join(',')}`)
      const found = ids
        .map((id) => [id, rows ? rows[id] : { id, ...available }] as const)
        .filter((entry): entry is readonly [string, object] => entry[1] !== undefined)

      return Promise.resolve(new Map(found))
    }

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        findDischargeIdentity: () => {
          calls.push('findDischargeIdentity')
          return Promise.resolve(existingId)
        },
        lockDocks: lock('lockDocks', docks, { status: 'AVAILABLE' }),
        lockCustomers: lock('lockCustomers', customers, { status: 'AVAILABLE' }),
        lockUsers: lock('lockUsers', users, { accessStatus: 'ACTIVE', role: 'OPERATIONS_LEAD' }),
        createPlannedDischarge: (command: CreatePlannedDischargeCommand) => {
          calls.push('createPlannedDischarge')
          commands.push(command)
          return Promise.resolve(result)
        },
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(
    DischargeRepository,
    () => ({ findDetail: () => Promise.resolve(detail) }) as unknown as DischargeRepository,
  )

  return { calls, commands, detail }
}

function restoreRepositories() {
  app.container.restore(DischargePreparationRepository)
  app.container.restore(DischargeRepository)
}

function buildInput(
  overrides: Partial<CreatePlannedDischargeInput> = {},
): CreatePlannedDischargeInput {
  return {
    id: DISCHARGE_ID,
    vesselName: '  MV Unit  ',
    vesselImo: '   ',
    vesselComment: '',
    dockId: DOCK_ID,
    expectedStartAt: DateTime.fromISO('2026-10-01T06:00:00.000+02:00', { setZone: true }),
    productLots: [
      {
        customerId: CUSTOMER_ID,
        productName: ' Blé tendre ',
        expectedQuantityTonnes: '1200.5',
        description: '  ',
      },
    ],
    shifts: [
      {
        plannedStartAt: DateTime.fromISO('2026-10-01T14:00:00.000+02:00', { setZone: true }),
        plannedEndAt: DateTime.fromISO('2026-10-01T22:00:00.000+02:00', { setZone: true }),
        responsibleUserId: RESPONSIBLE_ID,
      },
      {
        plannedStartAt: DateTime.fromISO('2026-10-01T06:00:00.000+02:00', { setZone: true }),
        plannedEndAt: DateTime.fromISO('2026-10-01T14:00:00.000+02:00', { setZone: true }),
        responsibleUserId: RESPONSIBLE_ID,
      },
    ],
    ...overrides,
  }
}

test.group('Create planned discharge use case', (group) => {
  group.each.teardown(() => restoreRepositories())

  test('creates the discharge from normalized values', async ({ assert }) => {
    const { commands, detail } = stubRepositories()
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)

    const outcome = await useCase.handle(buildInput())

    assert.deepEqual(outcome, { discharge: detail, created: true })
    assert.lengthOf(commands, 1)
    const [command] = commands
    assert.equal(command.vesselName, 'MV Unit')
    assert.isNull(command.vesselImo)
    assert.isNull(command.vesselComment)
    assert.equal(command.productLots[0].productName, 'Blé tendre')
    assert.isNull(command.productLots[0].description)
    assert.equal(command.productLots[0].expectedQuantityTonnes.toFixed(3), '1200.500')
  })

  test('numbers the shifts in planned start order', async ({ assert }) => {
    const { commands } = stubRepositories()
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)
    const input = buildInput()

    await useCase.handle(input)

    assert.deepEqual(
      commands[0].shifts.map((shift) => [shift.sequence, shift.plannedStartAt.toMillis()]),
      [
        [1, input.shifts[1].plannedStartAt.toMillis()],
        [2, input.shifts[0].plannedStartAt.toMillis()],
      ],
    )
  })

  test('returns an already created discharge without creating it again', async ({ assert }) => {
    const { calls, detail } = stubRepositories({ existingId: DISCHARGE_ID })
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)

    const outcome = await useCase.handle(buildInput())

    assert.deepEqual(outcome, { discharge: detail, created: false })
    assert.notInclude(calls, 'createPlannedDischarge')
  })

  test('treats a creation that lost the race for its identity as a replay', async ({ assert }) => {
    const { detail } = stubRepositories({ result: { kind: 'DUPLICATE_ID' } })
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)

    const outcome = await useCase.handle(buildInput())

    assert.deepEqual(outcome, { discharge: detail, created: false })
  })
})

async function rejectedIssues(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return (error.messages as { field: string; rule: string }[]).map((issue) => [
        issue.field,
        issue.rule,
      ])
    }

    throw error
  }

  throw new Error('expected the preparation to be rejected')
}

test.group('Create planned discharge use case refusals', (group) => {
  group.each.teardown(() => restoreRepositories())

  test('rejects an incoherent preparation before any lock or write', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)
    const input = buildInput()
    input.shifts[0].plannedStartAt = input.shifts[1].plannedStartAt.plus({ hours: 1 })

    const issues = await rejectedIssues(useCase.handle(input))

    assert.deepEqual(issues, [
      ['shifts.0.plannedStartAt', 'shiftOverlap'],
      ['shifts.1.plannedStartAt', 'shiftOverlap'],
    ])
    assert.deepEqual(calls, [])
  })

  test('locks docks, then customers, then users, each once', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)
    const input = buildInput()
    input.productLots.push({ ...input.productLots[0], productName: 'Orge' })

    await useCase.handle(input)

    assert.deepEqual(calls, [
      'findDischargeIdentity',
      `lockDocks:${DOCK_ID}`,
      `lockCustomers:${CUSTOMER_ID}`,
      `lockUsers:${RESPONSIBLE_ID}`,
      'createPlannedDischarge',
    ])
  })

  test('rejects a dock that is archived or missing under lock', async ({ assert }) => {
    for (const docks of [{ [DOCK_ID]: { id: DOCK_ID, status: 'ARCHIVED' } }, {}]) {
      const { calls } = stubRepositories({ docks })
      const useCase = await app.container.make(CreatePlannedDischargeUseCase)

      const issues = await rejectedIssues(useCase.handle(buildInput()))

      assert.deepEqual(issues, [['dockId', 'availableDock']])
      assert.notInclude(calls, 'createPlannedDischarge')
      restoreRepositories()
    }
  })

  test('reports every unavailable customer and ineligible responsible together', async ({
    assert,
  }) => {
    const otherCustomer = '55555555-5555-4555-8555-555555555555'
    const observer = '66666666-6666-4666-8666-666666666666'
    const { calls } = stubRepositories({
      customers: { [CUSTOMER_ID]: { id: CUSTOMER_ID, status: 'AVAILABLE' } },
      users: {
        [RESPONSIBLE_ID]: {
          id: RESPONSIBLE_ID,
          accessStatus: 'DEACTIVATED',
          role: 'OPERATIONS_LEAD',
        },
        [observer]: { id: observer, accessStatus: 'ACTIVE', role: 'OBSERVER' },
      },
    })
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)
    const input = buildInput()
    input.productLots.push({ ...input.productLots[0], customerId: otherCustomer })
    input.shifts[1].responsibleUserId = observer

    const issues = await rejectedIssues(useCase.handle(input))

    assert.deepEqual(issues, [
      ['productLots.1.customerId', 'availableCustomer'],
      ['shifts.0.responsibleUserId', 'eligibleShiftResponsible'],
      ['shifts.1.responsibleUserId', 'eligibleShiftResponsible'],
    ])
    assert.notInclude(calls, 'createPlannedDischarge')
  })

  test('reports a lot identity clash the database caught as a duplicate lot', async ({
    assert,
  }) => {
    stubRepositories({ result: { kind: 'DUPLICATE_LOT_IDENTITY' } })
    const useCase = await app.container.make(CreatePlannedDischargeUseCase)

    const issues = await rejectedIssues(useCase.handle(buildInput()))

    assert.deepEqual(issues, [['productLots.0.productName', 'productLotIdentityUnique']])
  })
})
