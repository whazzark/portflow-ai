import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { buildDischargeDetail, buildLot, listedDischarge } from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeCorrections,
  renderDischargeDetail,
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
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  fireEvent.click(within(lots).getByRole('button', { name: 'Remove Soufflet Négoce · Orge' }))

  return screen.findByRole('alertdialog', { name: 'Remove product lot?' })
}

test('removes a product lot after confirmation', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeDetail(PLANNED.id)
  const dialog = await openRemoval()

  expect(dialog).toHaveTextContent('Soufflet Négoce · Orge')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(await screen.findByText('Product lot removed')).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Soufflet Négoce · Orge' })).not.toBeInTheDocument()
  expect(state.lotRequests).toEqual([{ method: 'DELETE', lotId: 'lot-barley' }])
})

test('keeps the dialog open when the lot has warehouse door assignments', async () => {
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

  renderDischargeDetail(PLANNED.id)
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

  renderDischargeDetail(PLANNED.id)
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  const remove = within(lots).getByRole('button', { name: 'Remove Cargill France · Blé tendre' })

  expect(remove).toBeDisabled()
  expect(remove).toHaveAccessibleDescription('A discharge needs at least one product lot')
})

test('offers no lot action on an active discharge', async () => {
  mockDischargeCorrections({ detail: { ...PLANNED, status: 'ACTIVE' } })

  renderDischargeDetail(PLANNED.id)
  const lots = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(lots).queryByRole('button')).not.toBeInTheDocument()
})
