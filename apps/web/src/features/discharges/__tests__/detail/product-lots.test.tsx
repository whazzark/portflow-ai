import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { DischargeDetailDto, StartProblemDto } from '@/features/discharges/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_OBSERVER,
  API_BASE_URL,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildStartProblem,
  listedDischarge,
  PLANNING_DOORS,
} from '../support/fixtures'
import {
  mockDischargeDetail,
  mockDischargePlanning,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

const ENDED_PERIOD = {
  effectiveFrom: '2026-09-01T05:00:00.000Z',
  effectiveTo: '2026-09-03T17:00:00.000Z',
}

function renderLots(overrides: Partial<DischargeDetailDto>) {
  mockDischargeDetail({ details: [buildDischargeDetail(OCEAN_CEDAR, overrides)] })
  renderDischargeTab(OCEAN_CEDAR.id, 'product-lots')

  return screen.findByRole('region', { name: 'Product lots' })
}

test('lists the lots under each customer, with its subtotal and the expected total', async () => {
  const region = await renderLots({
    productLots: [
      buildLot({
        id: 'lot-a',
        description: 'Protein 11.5%',
        expectedQuantityTonnes: '12500.500',
        productName: 'Blé tendre',
      }),
      buildLot({ id: 'lot-b', productName: 'Orge', expectedQuantityTonnes: '0.250' }),
      buildLot({
        id: 'lot-c',
        customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
        productName: 'Blé tendre',
      }),
    ],
    expectedTonnage: '13500.750',
  })

  const [, cargill, soufflet] = within(region).getAllByRole('rowgroup')
  expect(within(region).getByRole('rowgroup', { name: 'Cargill France' })).toBe(cargill)
  expect(within(region).getByRole('rowgroup', { name: 'Soufflet Négoce' })).toBe(soufflet)

  const [cargillHeader, wheat, barley] = within(cargill).getAllByRole('row')
  expect(cargillHeader).toHaveTextContent('2 lots')
  expect(cargillHeader).toHaveTextContent('12,500.750 t')
  expect(wheat).toHaveTextContent('Blé tendre')
  expect(wheat).toHaveTextContent('Protein 11.5%')
  expect(wheat).toHaveTextContent('12,500.500 t')
  expect(barley).toHaveTextContent('0.250 t')
  // The same product for two customers is two lots, never merged.
  const [souffletHeader] = within(soufflet).getAllByRole('row')
  expect(souffletHeader).toHaveTextContent('1 lot')
  expect(souffletHeader).not.toHaveTextContent('lots')
  expect(within(soufflet).getAllByRole('row')).toHaveLength(2)
  expect(soufflet).toHaveTextContent('1,000.000 t')
  // An absent description leaves nothing behind.
  expect(region).not.toHaveTextContent('Not specified')

  const total = within(region).getByRole('rowheader', { name: 'Expected total' })
  expect(total.closest('tr')).toHaveTextContent('13,500.750 t')
})

test('shows the doors a lot holds as chips, and its ended ones a click away', async () => {
  const region = await renderLots({
    productLots: [
      buildLot({
        doorAssignments: [
          buildDoorPeriod({
            id: 'ended',
            ...ENDED_PERIOD,
            warehouseDoor: { id: 'door-b2', name: 'Door B2', status: 'AVAILABLE' },
            warehouse: { id: 'warehouse-b', name: 'Magasin B', status: 'AVAILABLE' },
          }),
          buildDoorPeriod({ id: 'open' }),
        ],
      }),
    ],
  })

  // A door still assigned carries no period: the cell already means "assigned now".
  const doors = within(within(region).getByRole('list', { name: 'Warehouse doors' })).getAllByRole(
    'listitem',
  )
  expect(doors.map((door) => door.textContent)).toEqual(['Magasin A › Door A1'])

  fireEvent.click(within(region).getByRole('button', { name: '1 ended' }))

  const history = await screen.findByRole('dialog', { name: 'Ended assignments' })
  expect(within(history).getByRole('listitem')).toHaveTextContent('Magasin B › Door B2')
  expect(within(history).getByRole('listitem')).toHaveTextContent('Ended')
})

test('keeps a lot with many doors on one line, the rest behind +N', async () => {
  const region = await renderLots({
    productLots: [
      buildLot({
        doorAssignments: ['1', '2', '3', '4', '5'].map((index) =>
          buildDoorPeriod({
            id: `open-${index}`,
            warehouseDoor: { id: `door-a${index}`, name: `Door A${index}`, status: 'AVAILABLE' },
          }),
        ),
      }),
    ],
  })

  const list = within(region).getByRole('list', { name: 'Warehouse doors' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  expect(list).toHaveTextContent('Door A1')
  expect(list).toHaveTextContent('Door A2')
  expect(list).not.toHaveTextContent('Door A3')

  fireEvent.click(within(list).getByRole('button', { name: 'Show 3 more warehouse doors' }))

  const all = await screen.findByRole('dialog', { name: 'Warehouse doors' })
  expect(
    within(all)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['1', '2', '3', '4', '5'].map((index) => `Magasin A › Door A${index}`))
})

test('says so when a lot has never had a door', async () => {
  const region = await renderLots({ productLots: [buildLot()] })

  expect(within(region).getByText('No warehouse door assigned')).toBeInTheDocument()
})

test('says no door is currently assigned when an active lot has only ended periods', async () => {
  const region = await renderLots({
    productLots: [buildLot({ doorAssignments: [buildDoorPeriod(ENDED_PERIOD)] })],
  })

  expect(within(region).getByText('No warehouse door currently assigned')).toBeInTheDocument()
})

test('does not say a closed discharge lacks a door: it holds none any more', async () => {
  const region = await renderLots({
    status: 'CLOSED',
    productLots: [buildLot({ doorAssignments: [buildDoorPeriod(ENDED_PERIOD)] })],
  })

  expect(within(region).queryByText('No warehouse door currently assigned')).not.toBeInTheDocument()
  expect(within(region).getByRole('list', { name: 'Warehouse doors' })).toHaveTextContent(
    'Magasin A › Door A1',
  )
})

test('keeps archived customers, warehouses, and doors readable and marks them', async () => {
  const region = await renderLots({
    productLots: [
      buildLot({
        customer: { id: 'customer-old', name: 'Négoce Retiré', status: 'ARCHIVED' },
        doorAssignments: [
          buildDoorPeriod({
            warehouseDoor: { id: 'door-old', name: 'Porte Retirée', status: 'ARCHIVED' },
            warehouse: { id: 'warehouse-old', name: 'Magasin Retiré', status: 'ARCHIVED' },
          }),
        ],
      }),
    ],
  })

  const lot = within(region).getByRole('rowgroup', { name: /Négoce Retiré/ })
  const [door] = within(lot).getAllByRole('listitem')
  expect(within(lot).getAllByText('Archived').length).toBeGreaterThanOrEqual(1)
  expect(door).toHaveTextContent('Magasin Retiré › Porte Retirée (Archived)')
})

test("shows a closed discharge's door left without an end as ended, not as held", async () => {
  const region = await renderLots({
    status: 'CLOSED',
    productLots: [buildLot({ doorAssignments: [buildDoorPeriod()] })],
  })

  fireEvent.click(within(region).getByRole('button', { name: 'History' }))

  const history = await screen.findByRole('dialog', { name: 'Door history' })
  const door = within(history).getByRole('listitem')
  expect(door).toHaveTextContent('Ended')
  expect(door).toHaveTextContent('end not recorded')
  expect(door).not.toHaveTextContent('Since')
})

// A planned discharge: Soufflet's lot has no door, Cargill's wheat holds Door A1, which an active
// discharge holds too, and Door B1, which nobody else does; Cargill's barley holds Door A2.
const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const SOUFFLET = { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' } as const
const PLANNED_LOTS = buildDischargeDetail(ATLANTIC_DAWN, {
  expectedTonnage: '3000.000',
  productLots: [
    buildLot({
      id: 'lot-wheat',
      productName: 'Blé tendre',
      doorAssignments: [
        buildDoorPeriod({ id: 'wheat-a1' }),
        buildDoorPeriod({
          id: 'wheat-b1',
          warehouseDoor: { id: 'door-b1', name: 'Door B1', status: 'AVAILABLE' },
          warehouse: { id: 'warehouse-b', name: 'Magasin B', status: 'AVAILABLE' },
        }),
      ],
    }),
    buildLot({
      id: 'lot-barley',
      productName: 'Orge',
      doorAssignments: [
        buildDoorPeriod({
          id: 'barley-a2',
          warehouseDoor: { id: 'door-a2', name: 'Door A2', status: 'AVAILABLE' },
        }),
      ],
    }),
    buildLot({ id: 'lot-peas', productName: 'Pois', customer: SOUFFLET }),
  ],
})
const HELD_A1 = buildStartProblem({
  family: 'ACTIVE_DISCHARGE_CONFLICT',
  code: 'WAREHOUSE_DOOR_HELD',
  subject: { type: 'WAREHOUSE_DOOR', id: 'door-a1' },
  context: { type: 'PRODUCT_LOT', id: 'lot-wheat' },
  holder: { dischargeId: 'discharge-ocean-cedar', vesselName: 'MV Ocean Cedar' },
})
const NO_DOOR_PEAS = buildStartProblem({ subject: { type: 'PRODUCT_LOT', id: 'lot-peas' } })

/** The start check of any discharge, answering what `problems` says at the time it is read. */
function mockStartCheck(problems: () => StartProblemDto[] | 'error') {
  const state = { requests: 0 }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/discharges/:id/start-check`, ({ params }) => {
      state.requests += 1
      const answer = problems()

      return answer === 'error'
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json({
            data: { dischargeId: String(params.id), shiftId: null, problems: answer },
          })
    }),
  )

  return state
}

const lotRow = (region: HTMLElement, product: string) => {
  const row = within(region)
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByText(product, { exact: true }))

  if (!row) {
    throw new Error(`No lot row for ${product}`)
  }

  return row
}

test('marks a lot without a door and a door held by an active discharge, and counts them', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS })
  mockStartCheck(() => [NO_DOOR_PEAS, HELD_A1])
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  const peas = lotRow(region, 'Pois')
  expect(within(peas).getByText('No door')).toBeInTheDocument()

  const wheat = lotRow(region, 'Blé tendre')
  const doors = within(within(wheat).getByRole('list', { name: 'Warehouse doors' })).getAllByRole(
    'listitem',
  )
  await waitFor(() => expect(doors[0]).toHaveTextContent('Held by MV Ocean Cedar'))
  // Only the door the active discharge holds is marked; the lot's other door reads as usual.
  expect(doors[1]).toHaveTextContent(/^Magasin B › Door B1$/)
  expect(lotRow(region, 'Orge')).not.toHaveTextContent('Held by')
  expect(lotRow(region, 'Orge')).not.toHaveTextContent('No door')

  expect(region).toHaveTextContent('3 lots · 2 customers · 3,000.000 t')
  expect(within(region).getByText('1 lot without a door')).toBeInTheDocument()
  expect(within(region).getByText('1 door held by another discharge')).toBeInTheDocument()
})

test('counts nothing amiss when every lot has a door nobody holds', async () => {
  const clean = { ...PLANNED_LOTS, productLots: PLANNED_LOTS.productLots.slice(0, 2) }
  const check = mockStartCheck(() => [])
  mockDischargePlanning({ detail: clean })
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  await waitFor(() => expect(check.requests).toBeGreaterThan(0))
  expect(region).toHaveTextContent('2 lots · 1 customer · 3,000.000 t')
  expect(region).not.toHaveTextContent('without a door')
  expect(region).not.toHaveTextContent('held by another discharge')
  expect(region).not.toHaveTextContent('No door')
})

test('clears a lot’s problem once a door is assigned to it, without a reload', async () => {
  const state = mockDischargePlanning({
    detail: PLANNED_LOTS,
    doors: [
      ...PLANNING_DOORS,
      {
        id: 'door-c1',
        name: 'Door C1',
        warehouse: { id: 'warehouse-c', name: 'Magasin C' },
        otherDischargeAssignments: [],
      },
    ],
  })
  const check = mockStartCheck(() =>
    state.lotDoorRequests.length > 0 ? [HELD_A1] : [NO_DOOR_PEAS, HELD_A1],
  )
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })
  await within(region).findByText('1 door held by another discharge')
  const checksBefore = check.requests

  const menu = await openLotMenu('Soufflet Négoce · Pois')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Assign doors' }))
  const dialog = await screen.findByRole('dialog', { name: 'Warehouse doors' })
  fireEvent.click(
    await within(dialog).findByRole('button', { name: 'Add', description: /^Door C1/ }),
  )
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(within(region).queryByText('No door')).not.toBeInTheDocument())
  expect(within(region).queryByText('1 lot without a door')).not.toBeInTheDocument()
  expect(check.requests).toBeGreaterThan(checksBefore)
})

test('still shows the lots and the ones without a door when the start check fails', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS })
  const check = mockStartCheck(() => 'error')
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  await waitFor(() => expect(check.requests).toBeGreaterThan(0))
  expect(within(lotRow(region, 'Pois')).getByText('No door')).toBeInTheDocument()
  expect(within(region).getByText('1 lot without a door')).toBeInTheDocument()
  // Held doors are unknown, not absent: nothing says either way.
  expect(region).not.toHaveTextContent('Held by')
  expect(region).not.toHaveTextContent('held by another discharge')
})

test('shows an observer the lots without a door, but not who holds a door', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS, user: ACTIVE_OBSERVER })
  const check = mockStartCheck(() => [NO_DOOR_PEAS, HELD_A1])
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(lotRow(region, 'Pois')).getByText('No door')).toBeInTheDocument()
  expect(within(region).getByText('1 lot without a door')).toBeInTheDocument()
  expect(region).not.toHaveTextContent('Held by')
  expect(check.requests).toBe(0)
})

test('offers Assign doors beside each door problem, opening that lot’s doors', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS })
  mockStartCheck(() => [NO_DOOR_PEAS, HELD_A1])
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  const held = await within(region).findByRole('button', {
    name: 'Assign doors for Cargill France · Blé tendre',
  })
  expect(lotRow(region, 'Blé tendre')).toContainElement(held)
  // A lot whose doors are fine has nothing to fix.
  expect(
    within(region).queryByRole('button', { name: 'Assign doors for Cargill France · Orge' }),
  ).not.toBeInTheDocument()

  fireEvent.click(
    within(lotRow(region, 'Pois')).getByRole('button', {
      name: 'Assign doors for Soufflet Négoce · Pois',
    }),
  )

  expect(await screen.findByRole('dialog', { name: 'Warehouse doors' })).toHaveAccessibleDescription(
    'Soufflet Négoce · Pois · 1,000.000 t',
  )
})

test('offers no Assign doors to an observer', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS, user: ACTIVE_OBSERVER })
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(lotRow(region, 'Pois')).getByText('No door')).toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: /^Assign doors/ })).not.toBeInTheDocument()
})

test('offers a preparer every change of a planned discharge’s lots', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS })
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(region).getByRole('button', { name: 'Add product lots' })).toBeInTheDocument()
  expect(within(region).getByRole('button', { name: 'Edit Cargill France' })).toBeInTheDocument()
  expect(
    within(region).getByRole('button', { name: 'Actions for Cargill France · Blé tendre' }),
  ).toBeInTheDocument()
  expect(region).not.toHaveTextContent('Read-only while the discharge is active')
})

test('offers no change to an observer of a planned discharge', async () => {
  mockDischargePlanning({ detail: PLANNED_LOTS, user: ACTIVE_OBSERVER })
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(region).queryByRole('button', { name: 'Add product lots' })).not.toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument()
})

test('reads an active discharge’s lots as read-only, without door problems', async () => {
  const active = buildDischargeDetail(OCEAN_CEDAR, {
    productLots: PLANNED_LOTS.productLots,
    expectedTonnage: '3000.000',
  })
  mockDischargePlanning({ detail: active })
  renderDischargeTab(OCEAN_CEDAR.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(region).getByText('Read-only while the discharge is active')).toBeInTheDocument()
  expect(region).toHaveTextContent('3 lots · 2 customers · 3,000.000 t')
  expect(region).not.toHaveTextContent('without a door')
  expect(within(region).queryByText('No door')).not.toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: 'Add product lots' })).not.toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument()
})

test('offers a preparer to add lots to a planned discharge without any', async () => {
  mockDischargePlanning({ detail: { ...PLANNED_LOTS, productLots: [], expectedTonnage: '0.000' } })
  renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const region = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(region).getByText('No product lots')).toBeInTheDocument()
  expect(within(region).getAllByRole('button', { name: 'Add product lots' }).length).toBeGreaterThan(0)
  expect(region).not.toHaveTextContent('0 lots')
})
