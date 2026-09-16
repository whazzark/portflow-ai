import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

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
