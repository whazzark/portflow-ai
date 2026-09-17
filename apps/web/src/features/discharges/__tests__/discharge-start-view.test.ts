import { describe, expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { startProblemSections, startReview } from '@/features/discharges/discharge-start-view'

import {
  buildDoorPeriod,
  buildPoolEntry,
  buildStartProblem,
  startableDetail,
} from './support/fixtures'

describe('startReview', () => {
  test('groups the lots by customer with only their current doors', () => {
    const detail = startableDetail()
    detail.productLots[0].doorAssignments.push(
      buildDoorPeriod({
        id: 'door-period-ended',
        effectiveTo: '2026-09-09T05:00:00.000Z',
        warehouseDoor: { id: 'door-z9', name: 'Door Z9', status: 'AVAILABLE' },
      }),
    )

    const review = startReview(detail, 'shift-first')

    expect(review.customers).toEqual([
      {
        customer: { id: 'customer-cargill', name: 'Cargill France', status: 'AVAILABLE' },
        lots: [
          {
            id: 'lot-wheat',
            productName: 'Blé tendre',
            doors: [{ id: 'door-a1', door: 'Door A1', warehouse: 'Magasin A' }],
          },
        ],
      },
      {
        customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
        lots: [
          {
            id: 'lot-barley',
            productName: 'Orge',
            doors: [{ id: 'door-b1', door: 'Door B1', warehouse: 'Magasin B' }],
          },
        ],
      },
    ])
  })

  test('counts the trucks the discharge still holds', () => {
    const detail = startableDetail()
    detail.truckPool.push(
      buildPoolEntry({ id: 'pool-b', truckId: 'truck-b', registration: 'BB-200-BB' }),
      buildPoolEntry({
        id: 'pool-c',
        truckId: 'truck-c',
        registration: 'CC-300-CC',
        releasedAt: '2026-09-09T05:00:00.000Z',
      }),
    )

    expect(startReview(detail, 'shift-first').heldTrucks).toBe(2)
  })

  test('describes the shift that would start with its current resources', () => {
    const detail = startableDetail()
    const [first] = detail.shifts
    first.trucks[0].truckStatus = 'SUSPENDED'

    expect(startReview(detail, 'shift-first').shift).toEqual({
      id: 'shift-first',
      label: formatShiftPeriod(first),
      responsible: 'Léa Martin',
      trucks: [{ id: 'truck-a', registration: 'AA-100-AA', suspended: true }],
      doors: [{ id: 'door-a1', door: 'Door A1', warehouse: 'Magasin A' }],
      weighingAreas: [{ id: 'area-north', name: 'Pont-bascule Nord' }],
    })
  })

  test('has no shift without a planned shift, or when the shift is not in the detail', () => {
    const detail = startableDetail()

    expect(startReview(detail, null).shift).toBeNull()
    expect(startReview(detail, 'shift-unknown').shift).toBeNull()
  })
})

describe('startProblemSections — by kind of element, in the section order of the detail', () => {
  const detail = startableDetail()
  const [first, later] = detail.shifts
  const shift = { type: 'SHIFT', id: 'shift-first' } as const
  const cedar = { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar' }
  const iroise = { dischargeId: 'discharge-iroise', vesselName: 'MV Iroise Trader' }
  const cedarLink = (tab: string) => ({ kind: 'discharge', dischargeId: 'discharge-cedar', tab })

  const truckHeld = (id: string, holder = cedar) =>
    buildStartProblem({
      family: 'ACTIVE_DISCHARGE_CONFLICT',
      code: 'TRUCK_HELD',
      subject: { type: 'TRUCK', id },
      holder,
    })
  const shiftHeading = (target: (typeof detail.shifts)[number]) => ({
    text: `Shift ${formatShiftPeriod(target)}`,
    link: { kind: 'section', tab: 'shifts', shiftId: target.id },
  })

  test('lists the dock, the lots, the pool, and the shifts, each linked to its section', () => {
    const sections = startProblemSections(
      [
        buildStartProblem({
          code: 'SHIFT_WITHOUT_TRUCK',
          subject: { type: 'SHIFT', id: 'shift-later' },
        }),
        truckHeld('truck-a'),
        buildStartProblem({ code: 'SHIFT_WITHOUT_WEIGHING_AREA', subject: shift }),
        buildStartProblem({
          code: 'LOT_WITHOUT_WAREHOUSE_DOOR',
          subject: { type: 'PRODUCT_LOT', id: 'lot-barley' },
        }),
        buildStartProblem({
          family: 'ACTIVE_DISCHARGE_CONFLICT',
          code: 'DOCK_HELD',
          subject: { type: 'DOCK', id: detail.dock.id },
          holder: iroise,
        }),
      ],
      detail,
    )

    expect(sections).toEqual([
      {
        key: 'dock',
        title: 'Dock',
        link: { kind: 'section', tab: 'overview' },
        items: [
          {
            key: 'dock',
            lines: [
              {
                text: `${detail.dock.name} serves`,
                holder: {
                  vesselName: 'MV Iroise Trader',
                  link: { kind: 'discharge', dischargeId: 'discharge-iroise', tab: 'overview' },
                },
              },
            ],
          },
        ],
      },
      {
        key: 'product-lots',
        title: 'Product lots',
        link: { kind: 'section', tab: 'product-lots' },
        items: [
          {
            key: 'lot:lot-barley',
            heading: { text: 'Soufflet Négoce · Orge' },
            lines: [{ text: 'No warehouse door assigned' }],
          },
        ],
      },
      {
        key: 'truck-pool',
        title: 'Truck pool',
        link: { kind: 'section', tab: 'truck-pool' },
        items: [
          {
            key: 'holder:discharge-cedar',
            lines: [
              {
                text: 'Truck AA-100-AA held by',
                holder: { vesselName: 'MV Ocean Cedar', link: cedarLink('truck-pool') },
              },
            ],
          },
        ],
      },
      {
        key: 'shifts',
        title: 'Shifts',
        link: { kind: 'section', tab: 'shifts' },
        items: [
          {
            key: 'shift:shift-first',
            heading: shiftHeading(first),
            lines: [{ text: 'No usable weighing area' }],
          },
          {
            key: 'shift:shift-later',
            heading: shiftHeading(later),
            lines: [{ text: 'No usable truck' }],
          },
        ],
      },
    ])
  })

  test('gathers what is wrong with a lot under it, in the lot order of the detail', () => {
    const [lots] = startProblemSections(
      [
        buildStartProblem({
          family: 'ACTIVE_DISCHARGE_CONFLICT',
          code: 'WAREHOUSE_DOOR_HELD',
          subject: { type: 'WAREHOUSE_DOOR', id: 'door-b1' },
          context: { type: 'PRODUCT_LOT', id: 'lot-barley' },
          holder: cedar,
        }),
        buildStartProblem({
          family: 'UNAVAILABLE_REFERENCE',
          code: 'CUSTOMER_ARCHIVED',
          subject: { type: 'CUSTOMER', id: 'customer-cargill' },
          context: { type: 'PRODUCT_LOT', id: 'lot-wheat' },
        }),
        buildStartProblem({
          family: 'UNAVAILABLE_REFERENCE',
          code: 'WAREHOUSE_DOOR_ARCHIVED',
          subject: { type: 'WAREHOUSE_DOOR', id: 'door-b1' },
          context: { type: 'PRODUCT_LOT', id: 'lot-barley' },
        }),
      ],
      detail,
    )

    expect(lots.items).toEqual([
      {
        key: 'lot:lot-wheat',
        heading: { text: 'Cargill France · Blé tendre' },
        lines: [{ text: 'Customer Cargill France is archived' }],
      },
      {
        key: 'lot:lot-barley',
        heading: { text: 'Soufflet Négoce · Orge' },
        lines: [
          {
            text: 'Door Door B1 · Magasin B held by',
            holder: { vesselName: 'MV Ocean Cedar', link: cedarLink('product-lots') },
          },
          { text: 'Door Door B1 · Magasin B is archived' },
        ],
      },
    ])
  })

  test('reads the trucks a discharge holds as one line, with their registrations', () => {
    const withPool = startableDetail()
    withPool.truckPool.push(
      buildPoolEntry({ id: 'pool-b', truckId: 'truck-b', registration: 'BB-200-BB' }),
    )

    const [pool] = startProblemSections([truckHeld('truck-a'), truckHeld('truck-b')], withPool)

    expect(pool.items).toEqual([
      {
        key: 'holder:discharge-cedar',
        lines: [
          {
            text: '2 trucks held by',
            holder: { vesselName: 'MV Ocean Cedar', link: cedarLink('truck-pool') },
            detail: 'AA-100-AA, BB-200-BB',
          },
        ],
      },
    ])
  })

  test.each([
    [
      buildStartProblem({ code: 'NO_PRODUCT_LOT', subject: { type: 'DISCHARGE', id: detail.id } }),
      'product-lots',
      'No product lot',
    ],
    [
      buildStartProblem({
        code: 'NO_PLANNED_SHIFT',
        subject: { type: 'DISCHARGE', id: detail.id },
      }),
      'shifts',
      'No planned shift',
    ],
    [
      buildStartProblem({
        family: 'UNAVAILABLE_REFERENCE',
        code: 'DOCK_ARCHIVED',
        subject: { type: 'DOCK', id: detail.dock.id },
      }),
      'dock',
      `${detail.dock.name} is archived`,
    ],
  ] as const)('places %o without a heading', (problem, section, text) => {
    expect(startProblemSections([problem], detail)).toMatchObject([
      { key: section, items: [{ lines: [{ text }] }] },
    ])
  })

  test.each([
    [
      buildStartProblem({ code: 'SHIFT_WITHOUT_WAREHOUSE_DOOR', subject: shift }),
      'No usable warehouse door',
    ],
    [
      buildStartProblem({
        family: 'UNAVAILABLE_REFERENCE',
        code: 'WAREHOUSE_DOOR_ARCHIVED',
        subject: { type: 'WAREHOUSE_DOOR', id: 'door-a1' },
        context: shift,
      }),
      'Door Door A1 · Magasin A is archived',
    ],
    [
      buildStartProblem({
        family: 'UNAVAILABLE_REFERENCE',
        code: 'WEIGHING_AREA_ARCHIVED',
        subject: { type: 'WEIGHING_AREA', id: 'area-north' },
        context: shift,
      }),
      'Weighing area Pont-bascule Nord is archived',
    ],
    [
      buildStartProblem({
        family: 'UNAVAILABLE_REFERENCE',
        code: 'TRUCK_ARCHIVED',
        subject: { type: 'TRUCK', id: 'truck-a' },
        context: shift,
      }),
      'Truck AA-100-AA is archived',
    ],
    [
      buildStartProblem({
        family: 'INELIGIBLE_RESPONSIBLE',
        code: 'RESPONSIBLE_INELIGIBLE',
        subject: { type: 'USER', id: 'lead-1' },
        context: shift,
      }),
      'Léa Martin can no longer be responsible',
    ],
  ] as const)('places %o under its shift', (problem, text) => {
    expect(startProblemSections([problem], detail)).toEqual([
      {
        key: 'shifts',
        title: 'Shifts',
        link: { kind: 'section', tab: 'shifts' },
        items: [{ key: 'shift:shift-first', heading: shiftHeading(first), lines: [{ text }] }],
      },
    ])
  })

  test('keeps a general wording, without a heading, when the detail no longer knows the subject', () => {
    const sections = startProblemSections(
      [
        buildStartProblem({
          code: 'LOT_WITHOUT_WAREHOUSE_DOOR',
          subject: { type: 'PRODUCT_LOT', id: 'gone' },
        }),
        buildStartProblem({ code: 'SHIFT_WITHOUT_TRUCK', subject: { type: 'SHIFT', id: 'gone' } }),
        buildStartProblem({
          family: 'UNAVAILABLE_REFERENCE',
          code: 'TRUCK_ARCHIVED',
          subject: { type: 'TRUCK', id: 'gone' },
          context: { type: 'SHIFT', id: 'gone' },
        }),
        truckHeld('gone'),
      ],
      detail,
    )

    expect(sections.map(({ key, items }) => ({ key, items }))).toEqual([
      {
        key: 'product-lots',
        items: [
          { key: 'general', lines: [{ text: 'A product lot has no warehouse door assigned' }] },
        ],
      },
      {
        key: 'truck-pool',
        items: [
          {
            key: 'holder:discharge-cedar',
            lines: [
              {
                text: 'A truck of the pool held by',
                holder: { vesselName: 'MV Ocean Cedar', link: cedarLink('truck-pool') },
              },
            ],
          },
        ],
      },
      {
        key: 'shifts',
        items: [
          {
            key: 'general',
            lines: [
              { text: 'A shift has no usable truck' },
              { text: 'A truck of a shift is archived' },
            ],
          },
        ],
      },
    ])
  })
})
