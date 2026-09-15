import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeCorrections,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const WHEAT = buildLot({ id: 'lot-wheat', productName: 'Blé tendre' })
const BARLEY = buildLot({
  id: 'lot-barley',
  productName: 'Orge',
  expectedQuantityTonnes: '500.000',
  customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
})
const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT, BARLEY],
  expectedTonnage: '1500.000',
})

async function openRemoval() {
  const menu = await openLotMenu('Soufflet Négoce · Orge')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Remove' }))

  return screen.findByRole('alertdialog', { name: 'Remove product lot?' })
}

test('removes a product lot after confirmation', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openRemoval()

  expect(dialog).toHaveTextContent('Soufflet Négoce · Orge')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(await screen.findByText('Product lot removed')).toBeInTheDocument()
  expect(screen.queryByRole('rowgroup', { name: 'Soufflet Négoce' })).not.toBeInTheDocument()
  expect(state.lotRequests).toEqual([{ method: 'DELETE', lotId: 'lot-barley' }])
})

test('keeps the dialog open when the server finds warehouse door assignments', async () => {
  mockDischargeCorrections({
    detail: PLANNED,
    respondToLot: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS',
          message: 'This product lot has warehouse door assignments',
        },
      },
    }),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openRemoval()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

  expect(
    await within(dialog).findByText('This product lot has warehouse door assignments'),
  ).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeDisabled()
})

test('keeps the only lot from being removed', async () => {
  mockDischargeCorrections({
    detail: { ...PLANNED, productLots: [WHEAT], expectedTonnage: '1000.000' },
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const menu = await openLotMenu('Cargill France · Blé tendre')
  const remove = within(menu).getByRole('menuitem', { name: 'Remove' })

  expect(remove).toHaveAttribute('aria-disabled', 'true')
  expect(remove).toHaveAccessibleDescription('A discharge needs at least one product lot')
})

test('keeps a lot that ever had a warehouse door from being removed', async () => {
  const reason = 'This product lot has warehouse door assignments'
  const state = mockDischargeCorrections({
    detail: {
      ...PLANNED,
      productLots: [
        WHEAT,
        {
          ...BARLEY,
          doorAssignments: [buildDoorPeriod({ effectiveTo: '2026-09-09T05:00:00.000Z' })],
        },
      ],
    },
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const menu = await openLotMenu('Soufflet Négoce · Orge')
  const remove = within(menu).getByRole('menuitem', { name: 'Remove' })

  expect(remove).toHaveAttribute('aria-disabled', 'true')
  expect(remove).toHaveAccessibleDescription(reason)
  // The reason is shown in a tooltip, only once the item is reached.
  const tooltip = { selector: '[data-slot="tooltip-content"]' }
  expect(screen.queryByText(reason, tooltip)).not.toBeInTheDocument()
  fireEvent.focus(remove)
  expect(await screen.findByText(reason, tooltip)).toBeInTheDocument()
  fireEvent.click(remove)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.lotRequests).toEqual([])
})

test('offers no lot action on an active discharge', async () => {
  mockDischargeCorrections({ detail: { ...PLANNED, status: 'ACTIVE' } })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const lots = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(lots).queryByRole('button')).not.toBeInTheDocument()
})
