import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatTonnes } from '@/features/discharges/discharge-detail-view'

import {
  AVAILABLE_CUSTOMERS,
  buildDischargeDetail,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  mockDischargeCorrections,
  renderDischargeDetail,
} from '../support/test-helpers'

allowFormJourneyTime()

const WHEAT = buildLot({ id: 'lot-wheat', expectedQuantityTonnes: '1000.000' })
const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT],
  expectedTonnage: '1000.000',
})

test('adds a product lot to a planned discharge', async () => {
  const state = mockDischargeCorrections({ detail: PLANNED })

  renderDischargeDetail(PLANNED.id)
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  fireEvent.click(within(lots).getByRole('button', { name: 'Add product lot' }))

  const sheet = await screen.findByRole('dialog', { name: 'Add product lot' })
  await chooseOption(sheet, 'Customer', AVAILABLE_CUSTOMERS[1].companyName)
  change(within(sheet).getByRole('textbox', { name: 'Product name' }), 'Orge')
  change(within(sheet).getByRole('textbox', { name: 'Expected quantity (t)' }), '250.25')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add product lot' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Add product lot' })).not.toBeInTheDocument(),
  )
  expect(
    await within(lots).findByRole('article', {
      name: `${AVAILABLE_CUSTOMERS[1].companyName} · Orge`,
    }),
  ).toBeInTheDocument()
  expect(screen.getByText(formatTonnes('1250.250'))).toBeInTheDocument()
  expect(screen.getByText('Product lot added')).toBeInTheDocument()
  expect(state.lotRequests).toEqual([
    {
      method: 'POST',
      body: {
        customerId: AVAILABLE_CUSTOMERS[1].id,
        productName: 'Orge',
        expectedQuantityTonnes: '250.25',
        description: null,
      },
    },
  ])
})

test('offers to add a lot from the empty section of a planned discharge', async () => {
  mockDischargeCorrections({ detail: { ...PLANNED, productLots: [], expectedTonnage: '0.000' } })

  renderDischargeDetail(PLANNED.id)
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  const addButtons = within(lots).getAllByRole('button', { name: 'Add product lot' })

  expect(addButtons.length).toBeGreaterThanOrEqual(1)
  fireEvent.click(addButtons[addButtons.length - 1])
  expect(await screen.findByRole('dialog', { name: 'Add product lot' })).toBeInTheDocument()
})
