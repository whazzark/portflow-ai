import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

async function vesselColumn() {
  const table = await screen.findByRole('table', { name: 'Discharges' })

  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)
}

test('reads planned discharges soonest first', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Planned/))

  expect(await vesselColumn()).toEqual(['MV Baltic Star', 'MV Atlantic Dawn'])
})

test('reads closed discharges most recent first', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Closed/))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  const imos = within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].textContent)

  expect(imos).toEqual(['9410003', '9410004'])
})

test('distinguishes two discharges sharing a vessel name', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Closed/))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  const rows = within(table).getAllByRole('row').slice(1)

  expect(within(rows[0]).getByText('Quai Nord')).toBeInTheDocument()
  expect(within(rows[1]).getByText('Quai Sud')).toBeInTheDocument()
  expect(within(rows[0]).getByText(/Cargill France/)).toBeInTheDocument()
  expect(within(rows[1]).getByText(/Soufflet Négoce/)).toBeInTheDocument()
})
