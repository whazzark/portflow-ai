import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeDetail } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

const ENDED_PERIOD = {
  effectiveFrom: '2026-09-01T05:00:00.000Z',
  effectiveTo: '2026-09-03T17:00:00.000Z',
}

function renderLots(overrides: Partial<DischargeDetailDto>) {
  mockDischargeDetail({ details: [buildDischargeDetail(OCEAN_CEDAR, overrides)] })
  renderDischargeDetail(OCEAN_CEDAR.id)

  return screen.findByRole('region', { name: 'Product lots' })
}

test('shows every lot once with its customer, product, quantity, and description', async () => {
  const region = await renderLots({
    productLots: [
      buildLot({
        id: 'lot-a',
        description: 'Protein 11.5%',
        expectedQuantityTonnes: '12500.500',
        productName: 'Blé tendre',
      }),
      buildLot({
        id: 'lot-b',
        customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
        productName: 'Blé tendre',
      }),
    ],
  })

  const cargill = within(region).getByRole('article', { name: 'Cargill France · Blé tendre' })
  const soufflet = within(region).getByRole('article', { name: 'Soufflet Négoce · Blé tendre' })
  expect(cargill).toHaveTextContent('12,500.500 t')
  expect(cargill).toHaveTextContent('Protein 11.5%')
  // The same product for two customers is two lots, never merged.
  expect(soufflet).toHaveTextContent('1,000.000 t')
  expect(soufflet).toHaveTextContent('Not specified')
  expect(within(region).getAllByRole('article')).toHaveLength(2)
})

test('lists each door with its warehouse and period, the ones in effect first', async () => {
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

  const doors = within(region).getAllByRole('listitem')
  expect(doors.map((door) => door.textContent)).toEqual([
    expect.stringContaining('Magasin A › Door A1'),
    expect.stringContaining('Magasin B › Door B2'),
  ])
  expect(doors[0]).toHaveTextContent('Since')
  expect(doors[0]).not.toHaveTextContent('Ended')
  expect(doors[1]).toHaveTextContent('Ended')
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
  expect(within(region).getByRole('listitem')).toHaveTextContent('Magasin A › Door A1')
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

  const lot = within(region).getByRole('article', { name: 'Négoce Retiré · Blé tendre' })
  const [door] = within(lot).getAllByRole('listitem')
  expect(within(lot).getAllByText('Archived').length).toBeGreaterThanOrEqual(3)
  expect(door).toHaveTextContent('Magasin Retiré')
  expect(door).toHaveTextContent('Porte Retirée')
})

test("shows a closed discharge's door left without an end as ended, not as held", async () => {
  const region = await renderLots({
    status: 'CLOSED',
    productLots: [buildLot({ doorAssignments: [buildDoorPeriod()] })],
  })

  const door = within(region).getByRole('listitem')
  expect(door).toHaveTextContent('Ended')
  expect(door).toHaveTextContent('end not recorded')
  expect(door).not.toHaveTextContent('Since')
})
