import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import {
  API_BASE_URL,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildStartProblem,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  mockDischargeCorrections,
  mockPlanningOptions,
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

test('shows the lot’s doors in its sheet, changed from Assign doors only', async () => {
  const held = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
    productLots: [{ ...WHEAT, doorAssignments: [buildDoorPeriod()] }, BARLEY],
    expectedTonnage: '1500.000',
  })
  const state = mockDischargeCorrections({ detail: held })
  mockPlanningOptions()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/discharges/:id/start-check`, ({ params }) =>
      HttpResponse.json({
        data: {
          dischargeId: String(params.id),
          shiftId: null,
          problems: [
            buildStartProblem({
              family: 'ACTIVE_DISCHARGE_CONFLICT',
              code: 'WAREHOUSE_DOOR_HELD',
              subject: { type: 'WAREHOUSE_DOOR', id: 'door-a1' },
              context: { type: 'PRODUCT_LOT', id: 'lot-wheat' },
              holder: { dischargeId: 'discharge-ocean-cedar', vesselName: 'MV Ocean Cedar' },
            }),
          ],
        },
      }),
    ),
  )

  renderDischargeTab(held.id, 'product-lots')
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  await within(lots).findByText('Held by MV Ocean Cedar')
  const sheet = await openEdit()

  const doors = within(sheet).getByRole('group', { name: 'Warehouse doors' })
  expect(doors).toHaveTextContent('Magasin A › Door A1')
  expect(doors).toHaveTextContent('Held by MV Ocean Cedar')
  expect(
    within(doors).getByText('Doors are changed from Assign doors, not from this form.'),
  ).toBeInTheDocument()

  change(within(sheet).getByRole('textbox', { name: 'Expected quantity (t)' }), '900')
  fireEvent.click(within(doors).getByRole('button', { name: 'Assign doors' }))

  const dialog = await screen.findByRole('dialog', { name: 'Warehouse doors' })
  expect(dialog).toHaveAccessibleDescription('Cargill France · Blé tendre · 1,000.000 t')
  expect(screen.queryByRole('dialog', { name: 'Edit product lot' })).not.toBeInTheDocument()
  expect(state.lotRequests).toEqual([])
})
