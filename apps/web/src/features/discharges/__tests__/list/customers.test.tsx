import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { DischargeDto, DischargeProductLotDto } from '@/features/discharges/types'

import { listedDischarge } from '../support/fixtures'
import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')
const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const CARGILL_LOIRE_STAR = listedDischarge('MV Loire Star', 'CLOSED')

function lot(customerName: string, index: number): DischargeProductLotDto {
  return {
    id: `lot-${customerName}-${index}`,
    customerId: `customer-${customerName}`,
    customerName,
    productName: `Product ${index}`,
  }
}

// Five distinct customers, one of them with two lots, in no particular order.
const FIVE_CUSTOMERS = [
  lot('Soufflet Négoce', 1),
  lot('Cargill France', 2),
  lot('Delta Minéraux', 3),
  lot('Atlantique Céréales', 4),
  lot('Cargill France', 5),
  lot('Baltic Eco Fuels', 6),
]

async function customersCell(discharge: DischargeDto, tab: RegExp) {
  const user = userEvent.setup()
  mockDischarges({ discharges: [{ ...discharge, productLots: FIVE_CUSTOMERS }] })

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(tab))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  const [, row] = within(table).getAllByRole('row')

  return within(row).getAllByRole('cell').at(-2) as HTMLElement
}

test('shows every customer of a discharge with one or two of them', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Ocean Cedar/ })

  expect(within(row).getByText('Cargill France, Soufflet Négoce')).toBeInTheDocument()
  expect(within(row).queryByText(/^\+\d/)).not.toBeInTheDocument()
})

test.each([
  ['Active', OCEAN_CEDAR, /Active/],
  ['Planned', ATLANTIC_DAWN, /Planned/],
  ['Closed', CARGILL_LOIRE_STAR, /Closed/],
])('shortens many customers to two names and the rest on %s', async (_tab, discharge, tab) => {
  const cell = await customersCell(discharge, tab)

  expect(within(cell).getByText('Atlantique Céréales, Baltic Eco Fuels')).toBeInTheDocument()
  expect(within(cell).getByRole('button', { name: /\+3/ })).toBeInTheDocument()
  expect(cell).not.toHaveTextContent('Soufflet Négoce')
})

test('lists every customer behind « +N » and to assistive technologies', async () => {
  const cell = await customersCell(OCEAN_CEDAR, /Active/)
  const more = within(cell).getByRole('button', {
    name: '+3: Atlantique Céréales, Baltic Eco Fuels, Cargill France, Delta Minéraux, Soufflet Négoce',
  })

  fireEvent.focus(more)

  const tooltip = await screen.findByRole('list', { name: 'Customers' })
  expect(
    within(tooltip)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    'Atlantique Céréales',
    'Baltic Eco Fuels',
    'Cargill France',
    'Delta Minéraux',
    'Soufflet Négoce',
  ])
})

test('does not open the discharge when « +N » is clicked', async () => {
  const user = userEvent.setup()
  const cell = await customersCell(OCEAN_CEDAR, /Active/)

  await user.click(within(cell).getByRole('button', { name: /\+3/ }))

  expect(screen.getByRole('table', { name: 'Discharges' })).toBeInTheDocument()
})

test('shows an em dash for a discharge with no customer yet', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Planned/))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Baltic Star/ })

  expect(within(row).getAllByRole('cell').at(-2)).toHaveTextContent('—')
})
