import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  AVAILABLE_CUSTOMERS,
  buildDischargeDetail,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  fillCustomerBlock,
  fillProduct,
  mockDischargeCorrections,
  productRow,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const [ACME, BETA] = AVAILABLE_CUSTOMERS
const WHEAT = buildLot({
  id: 'lot-wheat',
  customer: { id: ACME.id, name: ACME.companyName, status: 'AVAILABLE' },
  expectedQuantityTonnes: '1000.000',
})
const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT],
  expectedTonnage: '1000.000',
})

async function openAddSheet() {
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  const addButtons = within(lots).getAllByRole('button', { name: 'Add product lots' })
  fireEvent.click(addButtons[addButtons.length - 1])

  return { lots, sheet: await screen.findByRole('dialog', { name: 'Add product lots' }) }
}

test('adds the lots of several customers to a planned discharge in one request', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const { lots, sheet } = await openAddSheet()

  await fillCustomerBlock(1, ACME.companyName, 'Orge', '250.25')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product' }))
  fillProduct(productRow(1, 2), 'Colza', '100')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add customer' }))
  await fillCustomerBlock(2, BETA.companyName, 'Maïs', '50')

  expect(sheet).toHaveTextContent('3 lots · 400.250 t')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product lots' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Add product lots' })).not.toBeInTheDocument(),
  )
  expect(await within(lots).findByRole('rowgroup', { name: BETA.companyName })).toHaveTextContent(
    'Maïs',
  )
  expect(screen.getByText('3 product lots added')).toBeInTheDocument()
  const lot = (customerId: string, productName: string, expectedQuantityTonnes: string) => ({
    customerId,
    productName,
    expectedQuantityTonnes,
    description: null,
  })
  expect(state.lotRequests).toEqual([
    {
      method: 'POST',
      body: {
        productLots: [
          lot(ACME.id, 'Orge', '250.25'),
          lot(ACME.id, 'Colza', '100'),
          lot(BETA.id, 'Maïs', '50'),
        ],
      },
    },
  ])
})

test('shows a refusal on the lot it names and keeps the sheet and its values', async () => {
  const state = mockDischargeCorrections({
    detail: PLANNED,
    respondToLot: () => ({
      status: 422,
      body: {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            {
              field: 'productLots.2.customerId',
              message: 'This customer is no longer available',
              rule: 'availableCustomer',
            },
            {
              field: 'productLots.1.expectedQuantityTonnes',
              message: 'Too much',
              rule: 'range',
            },
          ],
        },
      },
    }),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const { sheet } = await openAddSheet()
  await fillCustomerBlock(1, ACME.companyName, 'Orge', '250')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product' }))
  fillProduct(productRow(1, 2), 'Colza', '100')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add customer' }))
  await fillCustomerBlock(2, BETA.companyName, 'Maïs', '50')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product lots' }))

  const secondBlock = within(sheet).getByRole('group', { name: 'Customer 2' })
  expect(await within(secondBlock).findByText('This customer is no longer available')).toBeVisible()
  expect(within(productRow(1, 2)).getByText('Too much')).toBeVisible()
  expect(within(productRow(1, 1)).queryByText('Too much')).not.toBeInTheDocument()
  expect(within(productRow(2, 1)).getByRole('textbox', { name: 'Product name' })).toHaveValue(
    'Maïs',
  )
  expect(state.lotRequests).toHaveLength(1)
})

test('refuses a product the customer already has, before sending anything', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const { sheet } = await openAddSheet()
  await fillCustomerBlock(1, ACME.companyName, ` ${WHEAT.productName.toUpperCase()} `, '10')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product lots' }))

  expect(
    await within(productRow(1, 1)).findByText(
      'This customer already has a lot with this product name',
    ),
  ).toBeVisible()
  expect(screen.getByRole('dialog', { name: 'Add product lots' })).toBeInTheDocument()
  expect(state.lotRequests).toEqual([])
})

test('offers a customer to one block only, and keeps at least one customer and one product', async () => {
  mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const { sheet } = await openAddSheet()

  expect(within(sheet).getByRole('button', { name: 'Remove customer 1' })).toBeDisabled()
  expect(within(productRow(1, 1)).getByRole('button', { name: 'Remove product 1' })).toBeDisabled()

  await fillCustomerBlock(1, ACME.companyName, 'Orge', '10')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add customer' }))
  const secondBlock = await within(sheet).findByRole('group', { name: 'Customer 2' })
  await userEvent.click(within(secondBlock).getByRole('button', { name: 'Show customer options' }))

  expect(await screen.findByRole('option', { name: BETA.companyName })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: ACME.companyName })).not.toBeInTheDocument()
})

test('closes on a discharge that has started meanwhile', async () => {
  mockDischargeCorrections({
    detail: PLANNED,
    respondToLot: () => ({
      status: 409,
      body: { error: { code: 'E_DISCHARGE_NOT_PLANNED', message: 'Not planned' } },
    }),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const { sheet } = await openAddSheet()
  await fillCustomerBlock(1, BETA.companyName, 'Orge', '10')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product lots' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Add product lots' })).not.toBeInTheDocument(),
  )
})

test('offers to add lots from the empty section of a planned discharge', async () => {
  mockDischargeCorrections({ detail: { ...PLANNED, productLots: [], expectedTonnage: '0.000' } })

  renderDischargeTab(PLANNED.id, 'product-lots')

  const { sheet } = await openAddSheet()
  expect(sheet).toBeInTheDocument()
})
