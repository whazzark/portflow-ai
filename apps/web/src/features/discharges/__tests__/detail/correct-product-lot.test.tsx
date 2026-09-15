import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { buildDischargeDetail, buildLot, listedDischarge } from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  mockDischargeCorrections,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

// The lot's customer is not among the available customers the sheet lists.

allowFormJourneyTime()

const WHEAT = buildLot({ id: 'lot-wheat', productName: 'Blé tendre', description: null })
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

async function openEdit() {
  const menu = await openLotMenu('Cargill France · Blé tendre')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }))

  return screen.findByRole('dialog', { name: 'Edit product lot' })
}

test('corrects a product lot, keeping its current customer offered', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openEdit()

  expect(within(sheet).getByRole('combobox', { name: 'Customer' })).toHaveValue('Cargill France')
  expect(within(sheet).getByRole('textbox', { name: 'Expected quantity (t)' })).toHaveValue(
    '1000.000',
  )

  change(within(sheet).getByRole('textbox', { name: 'Expected quantity (t)' }), '900')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit product lot' })).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('Product lot updated')).toBeInTheDocument()
  expect(state.lotRequests).toEqual([
    {
      method: 'PATCH',
      lotId: 'lot-wheat',
      body: {
        customerId: 'customer-cargill',
        productName: 'Blé tendre',
        expectedQuantityTonnes: '900',
        description: null,
      },
    },
  ])
})

test('keeps the sheet open on a refused product name', async () => {
  mockDischargeCorrections({
    detail: PLANNED,
    respondToLot: () => ({
      status: 422,
      body: {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            {
              field: 'productName',
              message: 'This customer already has a lot with this product name',
              rule: 'productLotIdentityUnique',
            },
          ],
        },
      },
    }),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openEdit()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(
    await within(sheet).findByText('This customer already has a lot with this product name'),
  ).toBeInTheDocument()
})

test('closes and refreshes when the lot no longer exists', async () => {
  const state = mockDischargeCorrections({
    detail: PLANNED,
    respondToLot: () => {
      state.current = { ...state.current, productLots: [BARLEY] }

      return {
        status: 404,
        body: { error: { code: 'E_PRODUCT_LOT_NOT_FOUND', message: 'Product lot not found' } },
      }
    },
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openEdit()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('This product lot no longer exists')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit product lot' })).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.queryByRole('rowgroup', { name: 'Cargill France' })).not.toBeInTheDocument(),
  )
})

test('leaves the lot untouched when the sheet is cancelled', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openEdit()
  change(within(sheet).getByRole('textbox', { name: 'Expected quantity (t)' }), '900')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit product lot' })).not.toBeInTheDocument(),
  )
  expect(state.lotRequests).toEqual([])
})
