import { randomUUID } from 'node:crypto'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import type { TestContext } from '@japa/runner/core'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import Discharge from '#models/discharge'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'

const PREPARING_ROLES = ['OPERATIONS_LEAD', 'OPERATIONS_ADMIN', 'ORGANIZATION_ADMIN'] as const

async function arrangePreparation() {
  const dock = await DockFactory.merge({ name: 'Quai Préparation' }).create()
  const cargill = await CustomerFactory.merge({ companyName: 'Cargill France' }).create()
  const soufflet = await CustomerFactory.merge({ companyName: 'Soufflet Négoce' }).create()
  const responsible = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()

  return { dock, cargill, soufflet, responsible }
}

type Preparation = Awaited<ReturnType<typeof arrangePreparation>>

/** A valid body whose later shift is listed first, to prove the API orders shifts itself. */
function buildBody({ dock, cargill, soufflet, responsible }: Preparation) {
  return {
    id: randomUUID(),
    vesselName: '  MV Préparation  ',
    vesselImo: '9321483',
    vesselComment: 'Draught restricted at low tide',
    dockId: dock.id,
    expectedStartAt: '2026-10-01T06:00:00.000+02:00',
    productLots: [
      {
        customerId: cargill.id,
        productName: 'Blé tendre',
        expectedQuantityTonnes: '1200.5',
        description: 'Hold 1',
      },
      {
        customerId: soufflet.id,
        productName: 'Blé tendre',
        expectedQuantityTonnes: '800',
        description: null,
      },
    ],
    shifts: [
      {
        plannedStartAt: '2026-10-01T14:00:00.000+02:00',
        plannedEndAt: '2026-10-01T22:00:00.000+02:00',
        responsibleUserId: responsible.id,
      },
      {
        plannedStartAt: '2026-10-01T06:00:00.000+02:00',
        plannedEndAt: '2026-10-01T13:00:00.000+02:00',
        responsibleUserId: responsible.id,
      },
    ],
  }
}

const millis = (value: string) => DateTime.fromISO(value, { setZone: true }).toMillis()

async function countPreparation() {
  return {
    discharges: (await Discharge.query()).length,
    lots: (await ProductLot.query()).length,
    shifts: (await Shift.query()).length,
  }
}

test.group('Planned discharge creation HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated and non-active requests without creating anything', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const before = await countPreparation()

    const unauthenticated = await client.post('/api/v1/discharges').json(buildBody(preparation))
    const nonActive = await client
      .post('/api/v1/discharges')
      .loginAs(pending)
      .json(buildBody(preparation))

    unauthenticated.assertStatus(401)
    nonActive.assertStatus(401)
    assert.deepEqual(await countPreparation(), before)
  })

  test('rejects an observer without creating anything', async ({ assert, client }) => {
    const preparation = await arrangePreparation()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const before = await countPreparation()

    const response = await client
      .post('/api/v1/discharges')
      .loginAs(observer)
      .json(buildBody(preparation))

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
    assert.deepEqual(await countPreparation(), before)
  })

  test('creates a planned discharge with its lots and shifts for every preparing role', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()

    for (const role of PREPARING_ROLES) {
      const actor = await UserFactory.apply('active').merge({ role }).create()
      const body = buildBody(preparation)

      const response = await client.post('/api/v1/discharges').loginAs(actor).json(body)

      response.assertStatus(201)
      const data = response.body().data
      assert.equal(data.id, body.id)
      assert.equal(data.status, 'PLANNED')
      assert.equal(data.vesselName, 'MV Préparation')
      assert.equal(data.vesselImo, '9321483')
      assert.equal(data.vesselComment, 'Draught restricted at low tide')
      assert.equal(data.dock.id, preparation.dock.id)
      assert.equal(millis(data.expectedStartAt), millis(body.expectedStartAt))
      assert.equal(data.expectedTonnage, '2000.500')
      assert.sameDeepMembers(
        data.productLots.map(
          (lot: {
            customer: { id: string }
            productName: string
            expectedQuantityTonnes: string
            description: string | null
            doorAssignments: unknown[]
          }) => ({
            customerId: lot.customer.id,
            productName: lot.productName,
            expectedQuantityTonnes: lot.expectedQuantityTonnes,
            description: lot.description,
            doorAssignments: lot.doorAssignments,
          }),
        ),
        [
          {
            customerId: preparation.cargill.id,
            productName: 'Blé tendre',
            expectedQuantityTonnes: '1200.500',
            description: 'Hold 1',
            doorAssignments: [],
          },
          {
            customerId: preparation.soufflet.id,
            productName: 'Blé tendre',
            expectedQuantityTonnes: '800.000',
            description: null,
            doorAssignments: [],
          },
        ],
      )
      assert.deepEqual(
        data.shifts.map(
          (shift: {
            status: string
            plannedStartAt: string
            responsible: { id: string }
            trucks: unknown[]
            warehouseDoors: unknown[]
            weighingAreas: unknown[]
          }) => ({
            status: shift.status,
            plannedStartAt: millis(shift.plannedStartAt),
            responsibleId: shift.responsible.id,
            trucks: shift.trucks,
            warehouseDoors: shift.warehouseDoors,
            weighingAreas: shift.weighingAreas,
          }),
        ),
        [body.shifts[1], body.shifts[0]].map((shift) => ({
          status: 'PLANNED',
          plannedStartAt: millis(shift.plannedStartAt),
          responsibleId: preparation.responsible.id,
          trucks: [],
          warehouseDoors: [],
          weighingAreas: [],
        })),
      )
      assert.deepEqual(data.truckPool, [])
    }
  })

  test('numbers the persisted shifts in planned start order', async ({ assert, client }) => {
    const preparation = await arrangePreparation()
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const body = buildBody(preparation)

    const response = await client.post('/api/v1/discharges').loginAs(lead).json(body)

    response.assertStatus(201)

    const shifts = await Shift.query().where('dischargeId', body.id).orderBy('sequence', 'asc')
    assert.deepEqual(
      shifts.map((shift) => [shift.sequence, shift.plannedStartAt.toMillis()]),
      [
        [1, millis(body.shifts[1].plannedStartAt)],
        [2, millis(body.shifts[0].plannedStartAt)],
      ],
    )
  })

  test('stores blank optional values as not specified', async ({ assert, client }) => {
    const preparation = await arrangePreparation()
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const body = buildBody(preparation)
    body.vesselImo = '  '
    body.vesselComment = ''
    body.productLots[0].description = ''

    const response = await client.post('/api/v1/discharges').loginAs(lead).json(body)

    response.assertStatus(201)
    const discharge = await Discharge.findOrFail(body.id)
    const lot = await ProductLot.query()
      .where('dischargeId', body.id)
      .where('customerId', preparation.cargill.id)
      .firstOrFail()
    assert.isNull(discharge.vesselImo)
    assert.isNull(discharge.vesselComment)
    assert.isNull(lot.description)
  })

  test('accepts contiguous shifts', async ({ client }) => {
    const preparation = await arrangePreparation()
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const body = buildBody(preparation)
    body.shifts[1].plannedEndAt = body.shifts[0].plannedStartAt

    const response = await client.post('/api/v1/discharges').loginAs(lead).json(body)

    response.assertStatus(201)
  })

  test('returns the existing discharge when the same creation is submitted again', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const body = buildBody(preparation)
    const before = await countPreparation()

    const first = await client.post('/api/v1/discharges').loginAs(lead).json(body)
    const replay = await client.post('/api/v1/discharges').loginAs(lead).json(body)

    first.assertStatus(201)
    replay.assertStatus(200)
    assert.equal(replay.body().data.id, body.id)
    assert.deepEqual(await countPreparation(), {
      discharges: before.discharges + 1,
      lots: before.lots + 2,
      shifts: before.shifts + 2,
    })
  })
})

type Body = ReturnType<typeof buildBody>

test.group('Planned discharge creation refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  async function expectRefusal(
    client: TestContext['client'],
    assert: TestContext['assert'],
    body: unknown,
    expectedFields: string[],
  ) {
    const lead = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
    const before = await countPreparation()

    const response = await client
      .post('/api/v1/discharges')
      .loginAs(lead)
      .json(body as object)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.includeMembers(
      response.body().error.details.map((detail: { field: string }) => detail.field),
      expectedFields,
    )
    assert.deepEqual(await countPreparation(), before)
  }

  function without<Key extends keyof Body>(body: Body, key: Key) {
    const { [key]: _removed, ...rest } = body

    return rest
  }

  test('rejects a missing or blank vessel name, dock, or expected start', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()

    await expectRefusal(client, assert, without(buildBody(preparation), 'vesselName'), [
      'vesselName',
    ])
    await expectRefusal(client, assert, { ...buildBody(preparation), vesselName: '   ' }, [
      'vesselName',
    ])
    await expectRefusal(client, assert, without(buildBody(preparation), 'dockId'), ['dockId'])
    await expectRefusal(client, assert, without(buildBody(preparation), 'expectedStartAt'), [
      'expectedStartAt',
    ])
  })

  test('rejects a preparation without a lot or without a shift', async ({ assert, client }) => {
    const preparation = await arrangePreparation()

    await expectRefusal(client, assert, { ...buildBody(preparation), productLots: [] }, [
      'productLots',
    ])
    await expectRefusal(client, assert, { ...buildBody(preparation), shifts: [] }, ['shifts'])
  })

  test('rejects an incomplete lot and an invalid quantity', async ({ assert, client }) => {
    const preparation = await arrangePreparation()

    for (const key of ['customerId', 'productName', 'expectedQuantityTonnes'] as const) {
      const body = buildBody(preparation)
      const { [key]: _removed, ...lot } = body.productLots[1]

      await expectRefusal(client, assert, { ...body, productLots: [body.productLots[0], lot] }, [
        `productLots.1.${key}`,
      ])
    }

    for (const expectedQuantityTonnes of ['0', '-1', '1.2345']) {
      const body = buildBody(preparation)
      body.productLots[0].expectedQuantityTonnes = expectedQuantityTonnes

      await expectRefusal(client, assert, body, ['productLots.0.expectedQuantityTonnes'])
    }
  })

  test('rejects a malformed IMO and an expected start without an offset', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()

    await expectRefusal(client, assert, { ...buildBody(preparation), vesselImo: '123' }, [
      'vesselImo',
    ])
    await expectRefusal(
      client,
      assert,
      { ...buildBody(preparation), expectedStartAt: '2026-10-01T06:00:00' },
      ['expectedStartAt'],
    )
  })

  test('rejects duplicate lots, an inverted shift, and overlapping shifts', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()

    const duplicate = buildBody(preparation)
    duplicate.productLots[1].customerId = preparation.cargill.id
    duplicate.productLots[1].productName = ' BLÉ TENDRE '
    await expectRefusal(client, assert, duplicate, [
      'productLots.0.productName',
      'productLots.1.productName',
    ])

    const inverted = buildBody(preparation)
    inverted.shifts[0].plannedEndAt = '2026-10-01T13:59:00.000+02:00'
    await expectRefusal(client, assert, inverted, ['shifts.0.plannedEndAt'])

    const overlapping = buildBody(preparation)
    overlapping.shifts[0].plannedStartAt = '2026-10-01T12:00:00.000+02:00'
    await expectRefusal(client, assert, overlapping, [
      'shifts.0.plannedStartAt',
      'shifts.1.plannedStartAt',
    ])
  })

  test('rejects an archived or unknown dock and an archived customer', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()
    const archivedDock = await DockFactory.apply('archived').create()
    const archivedCustomer = await CustomerFactory.apply('archived').create()

    await expectRefusal(client, assert, { ...buildBody(preparation), dockId: archivedDock.id }, [
      'dockId',
    ])
    await expectRefusal(
      client,
      assert,
      { ...buildBody(preparation), dockId: '00000000-0000-4000-8000-000000000000' },
      ['dockId'],
    )

    const body = buildBody(preparation)
    body.productLots[1].customerId = archivedCustomer.id
    await expectRefusal(client, assert, body, ['productLots.1.customerId'])
  })

  test('rejects a responsible who is an observer, deactivated, or pending', async ({
    assert,
    client,
  }) => {
    const preparation = await arrangePreparation()
    const ineligible = [
      await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create(),
      await UserFactory.apply('deactivated').merge({ role: 'OPERATIONS_LEAD' }).create(),
      await UserFactory.apply('invited').merge({ role: 'OPERATIONS_LEAD' }).create(),
    ]

    for (const user of ineligible) {
      const body = buildBody(preparation)
      body.shifts[1].responsibleUserId = user.id

      await expectRefusal(client, assert, body, ['shifts.1.responsibleUserId'])
    }
  })
})
