import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  type DischargeWriteAnswer,
  mockDischargeCorrections,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const CARGILL = { id: 'customer-cargill', name: 'Cargill France', status: 'AVAILABLE' as const }
const SOUFFLET = { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' as const }

const WHEAT = buildLot({ id: 'lot-wheat', customer: CARGILL, productName: 'Blé tendre' })
const BARLEY = buildLot({
  id: 'lot-barley',
  customer: CARGILL,
  productName: 'Orge',
  expectedQuantityTonnes: '300.000',
})
const RAPESEED = buildLot({
  id: 'lot-rapeseed',
  customer: CARGILL,
  productName: 'Colza',
  expectedQuantityTonnes: '200.000',
  description: 'Hold 2',
})
const SOUFFLET_BARLEY = buildLot({
  id: 'lot-soufflet-barley',
  customer: SOUFFLET,
  productName: 'Orge',
  expectedQuantityTonnes: '500.000',
})
const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT, BARLEY, RAPESEED, SOUFFLET_BARLEY],
  expectedTonnage: '2000.000',
})

const DIALOG = { name: 'Edit product lots' }

async function openCargillCorrection() {
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  const cargill = within(lots).getByRole('rowgroup', { name: 'Cargill France' })
  fireEvent.click(within(cargill).getByRole('button', { name: 'Edit Cargill France' }))

  return screen.findByRole('dialog', DIALOG)
}

function row(sheet: HTMLElement, product: number) {
  return within(sheet).getByRole('group', { name: `Product ${product}` })
}

const nameOf = (sheet: HTMLElement, product: number) =>
  within(row(sheet, product)).getByRole('textbox', { name: 'Product name' })
const quantityOf = (sheet: HTMLElement, product: number) =>
  within(row(sheet, product)).getByRole('textbox', { name: 'Expected quantity (t)' })

function refusal(status: number, code: string, details?: unknown[]): DischargeWriteAnswer {
  return { status, body: { error: { code, message: `Refused: ${code}`, details } } }
}

async function waitForClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog', DIALOG)).not.toBeInTheDocument())
}

test("corrects a customer's lots in one change, and shows them corrected", async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()

  expect(sheet).toHaveTextContent('Cargill France')
  expect([1, 2, 3].map((product) => nameOf(sheet, product))).toEqual([
    expect.objectContaining({ value: 'Blé tendre' }),
    expect.objectContaining({ value: 'Orge' }),
    expect.objectContaining({ value: 'Colza' }),
  ])
  expect(within(sheet).queryByRole('group', { name: 'Product 4' })).not.toBeInTheDocument()

  change(quantityOf(sheet, 2), '350.5')
  change(nameOf(sheet, 3), 'Colza bio')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitForClosed()
  expect(await screen.findByText('Product lots updated')).toBeInTheDocument()
  expect(state.customerLotRequests).toEqual([
    {
      customerId: 'customer-cargill',
      body: {
        customerId: 'customer-cargill',
        productLots: [
          {
            id: 'lot-wheat',
            productName: 'Blé tendre',
            expectedQuantityTonnes: '1000.000',
            description: null,
          },
          {
            id: 'lot-barley',
            productName: 'Orge',
            expectedQuantityTonnes: '350.5',
            description: null,
          },
          {
            id: 'lot-rapeseed',
            productName: 'Colza bio',
            expectedQuantityTonnes: '200.000',
            description: 'Hold 2',
          },
        ],
        removedProductLotIds: [],
      },
    },
  ])
  const cargill = screen.getByRole('rowgroup', { name: 'Cargill France' })
  expect(cargill).toHaveTextContent('Colza bio')
  expect(cargill).toHaveTextContent('350.500 t')
})

test('accepts two lots swapping their names', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  change(nameOf(sheet, 1), 'Orge')
  change(nameOf(sheet, 2), 'Blé tendre')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitForClosed()
  expect(state.customerLotRequests).toHaveLength(1)
})

test('points out rows sharing a name before sending anything', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  change(nameOf(sheet, 3), ' orge ')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(
    await within(row(sheet, 3)).findByText(
      'This customer already has a lot with this product name',
    ),
  ).toBeInTheDocument()
  expect(state.customerLotRequests).toEqual([])
})

test('shows a refused value on its row and keeps what was typed', async () => {
  mockDischargeCorrections({
    detail: PLANNED,
    respondToCustomerLots: () =>
      refusal(422, 'E_VALIDATION_ERROR', [
        {
          field: 'productLots.1.expectedQuantityTonnes',
          rule: 'regex',
          message: 'The quantity is not valid',
        },
      ]),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  change(quantityOf(sheet, 2), '42')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await within(row(sheet, 2)).findByText('The quantity is not valid')).toBeInTheDocument()
  expect(screen.getByRole('dialog', DIALOG)).toBeInTheDocument()
  expect(quantityOf(sheet, 2)).toHaveValue('42')
})

test('closes when the discharge started meanwhile', async () => {
  mockDischargeCorrections({
    detail: PLANNED,
    respondToCustomerLots: () => refusal(409, 'E_DISCHARGE_NOT_PLANNED'),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
  await waitForClosed()
})

test("closes and refreshes when the customer's lots changed meanwhile", async () => {
  const state = mockDischargeCorrections({
    detail: PLANNED,
    respondToCustomerLots: () => {
      state.current = { ...state.current, productLots: [WHEAT, SOUFFLET_BARLEY] }

      return refusal(404, 'E_PRODUCT_LOT_NOT_FOUND')
    },
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText("This customer's product lots changed")).toBeInTheDocument()
  await waitForClosed()
  await waitFor(() =>
    expect(screen.getByRole('rowgroup', { name: 'Cargill France' })).not.toHaveTextContent('Colza'),
  )
})

test('keeps the sheet open when the change could not be sent', async () => {
  mockDischargeCorrections({ detail: PLANNED, respondToCustomerLots: () => 'network-error' })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Unable to update the product lots')).toBeInTheDocument()
  expect(screen.getByRole('dialog', DIALOG)).toBeInTheDocument()
})

test('sends nothing when the correction is cancelled', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  change(quantityOf(sheet, 1), '1')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))

  await waitForClosed()
  expect(state.customerLotRequests).toEqual([])
})

test.each([
  ['an observer', ACTIVE_OBSERVER, 'PLANNED'],
  ['an active discharge', ACTIVE_OPERATIONS_LEAD, 'ACTIVE'],
  ['a closed discharge', ACTIVE_OPERATIONS_LEAD, 'CLOSED'],
] as const)('offers no correction of a customer to %s', async (_case, user, status) => {
  const detail = { ...PLANNED, status }
  mockDischargeCorrections({ user, detail })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const lots = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(lots).getByRole('rowgroup', { name: 'Cargill France' })).toBeInTheDocument()
  expect(within(lots).queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
})

test("keeps each lot's own correction beside its customer's", async () => {
  mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const lots = await screen.findByRole('region', { name: 'Product lots' })

  expect(within(lots).getByRole('button', { name: 'Edit Cargill France' })).toBeInTheDocument()
  expect(within(lots).getByRole('button', { name: 'Edit Soufflet Négoce' })).toBeInTheDocument()
  fireEvent.click(within(lots).getByRole('button', { name: 'Actions for Cargill France · Orge' }))
  expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
})

const DOORED_BARLEY = { ...BARLEY, doorAssignments: [buildDoorPeriod()] }

test('adds and removes lots of the customer in the same change', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Remove product 3' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product' }))
  change(nameOf(sheet, 3), 'Tournesol')
  change(quantityOf(sheet, 3), '75')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitForClosed()
  expect(state.customerLotRequests[0].body).toEqual({
    customerId: 'customer-cargill',
    productLots: [
      {
        id: 'lot-wheat',
        productName: 'Blé tendre',
        expectedQuantityTonnes: '1000.000',
        description: null,
      },
      {
        id: 'lot-barley',
        productName: 'Orge',
        expectedQuantityTonnes: '300.000',
        description: null,
      },
      { productName: 'Tournesol', expectedQuantityTonnes: '75', description: null },
    ],
    removedProductLotIds: ['lot-rapeseed'],
  })
  const cargill = screen.getByRole('rowgroup', { name: 'Cargill France' })
  expect(cargill).toHaveTextContent('Tournesol')
  expect(cargill).not.toHaveTextContent('Colza')
})

test('says why a lot with a warehouse door cannot be removed', async () => {
  mockDischargeCorrections({
    detail: { ...PLANNED, productLots: [WHEAT, DOORED_BARLEY, RAPESEED, SOUFFLET_BARLEY] },
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  const remove = within(sheet).getByRole('button', { name: 'Remove product 2' })

  expect(remove).toHaveAttribute('aria-disabled', 'true')
  expect(remove).toHaveAccessibleDescription('This product lot has warehouse door assignments')
  fireEvent.focus(remove)
  expect(
    await screen.findByText('This product lot has warehouse door assignments', {
      selector: '[data-slot="tooltip-content"]',
    }),
  ).toBeInTheDocument()
  fireEvent.click(remove)
  expect(nameOf(sheet, 2)).toHaveValue('Orge')
})

test("keeps the last lot of a discharge without other customers' lots", async () => {
  mockDischargeCorrections({ detail: { ...PLANNED, productLots: [WHEAT, BARLEY] } })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Remove product 2' }))

  expect(
    within(sheet).getByRole('button', { name: 'Remove product 1' }),
  ).toHaveAccessibleDescription('A discharge needs at least one product lot')
})

test("removes every lot of the customer while another customer's lots remain", async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  for (let product = 3; product >= 1; product -= 1) {
    fireEvent.click(within(sheet).getByRole('button', { name: `Remove product ${product}` }))
  }

  expect(
    within(sheet).getByText('Saving removes every product lot of this customer.'),
  ).toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitForClosed()
  expect(state.customerLotRequests[0].body).toEqual({
    customerId: 'customer-cargill',
    productLots: [],
    removedProductLotIds: ['lot-rapeseed', 'lot-barley', 'lot-wheat'],
  })
  await waitFor(() =>
    expect(screen.queryByRole('rowgroup', { name: 'Cargill France' })).not.toBeInTheDocument(),
  )
})

test.each([
  {
    refused: 'at its position',
    answer: refusal(422, 'E_VALIDATION_ERROR', [
      {
        field: 'removedProductLotIds.0',
        rule: 'removableProductLot',
        message: 'This product lot has warehouse door assignments',
      },
    ]),
  },
  { refused: 'as a conflict', answer: refusal(409, 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS') },
])(
  'brings back a lot whose removal is refused $refused, so the rest can be saved',
  async ({ answer }) => {
    let answered = false
    const state = mockDischargeCorrections({
      detail: PLANNED,
      respondToCustomerLots: () => {
        if (answered) {
          return undefined
        }
        answered = true

        return answer
      },
    })

    renderDischargeTab(PLANNED.id, 'product-lots')
    const sheet = await openCargillCorrection()
    const requestsBefore = state.detailRequests
    change(quantityOf(sheet, 1), '900')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove product 3' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('This product lot has warehouse door assignments'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', DIALOG)).toBeInTheDocument()
    await waitFor(() => expect(state.detailRequests).toBeGreaterThan(requestsBefore))
    expect(nameOf(sheet, 3)).toHaveValue('Colza')
    expect(quantityOf(sheet, 1)).toHaveValue('900')

    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitForClosed()
    expect(state.customerLotRequests[1].body).toMatchObject({
      productLots: [
        { id: 'lot-wheat', expectedQuantityTonnes: '900' },
        { id: 'lot-barley' },
        { id: 'lot-rapeseed', productName: 'Colza' },
      ],
      removedProductLotIds: [],
    })
  },
)

test('keeps the sheet open when the discharge would be left without any lot', async () => {
  mockDischargeCorrections({
    detail: PLANNED,
    respondToCustomerLots: () => refusal(409, 'E_DISCHARGE_LAST_PRODUCT_LOT'),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(
    await within(sheet).findByText('A discharge needs at least one product lot'),
  ).toBeInTheDocument()
  expect(screen.getByRole('dialog', DIALOG)).toBeInTheDocument()
})

const ACME = { id: 'available-1', name: 'Acme Logistics', status: 'AVAILABLE' as const }
const ACME_BARLEY = buildLot({
  id: 'lot-acme-barley',
  customer: ACME,
  productName: 'Orge',
  expectedQuantityTonnes: '100.000',
})
const WITH_ACME = { ...PLANNED, productLots: [WHEAT, BARLEY, ACME_BARLEY] }

test("moves a customer's lots to another customer, joining that customer's lots", async () => {
  const state = mockDischargeCorrections({ detail: WITH_ACME })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  expect(within(sheet).getByRole('combobox', { name: 'Customer' })).toHaveValue('Cargill France')

  await chooseOption(sheet, 'Customer', 'Acme Logistics')
  expect(within(sheet).getByText('Joins the 1 product lot of Acme Logistics.')).toBeInTheDocument()

  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
  expect(
    await within(row(sheet, 2)).findByText(
      'This customer already has a lot with this product name',
    ),
  ).toBeInTheDocument()
  expect(state.customerLotRequests).toEqual([])

  change(nameOf(sheet, 2), 'Orge brassicole')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitForClosed()
  expect(state.customerLotRequests[0]).toMatchObject({
    customerId: 'customer-cargill',
    body: { customerId: 'available-1', removedProductLotIds: [] },
  })
  expect(screen.queryByRole('rowgroup', { name: 'Cargill France' })).not.toBeInTheDocument()
  expect(screen.getByRole('rowgroup', { name: 'Acme Logistics' })).toHaveTextContent(
    'Orge brassicole',
  )
})

test('shows a customer refused by the server on the customer field', async () => {
  mockDischargeCorrections({
    detail: WITH_ACME,
    respondToCustomerLots: () =>
      refusal(422, 'E_VALIDATION_ERROR', [
        {
          field: 'customerId',
          rule: 'availableCustomer',
          message: 'This customer is no longer available',
        },
      ]),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const sheet = await openCargillCorrection()
  await chooseOption(sheet, 'Customer', 'Bêta Maritime')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await within(sheet).findByText('This customer is no longer available')).toBeInTheDocument()
  expect(screen.getByRole('dialog', DIALOG)).toBeInTheDocument()
})
