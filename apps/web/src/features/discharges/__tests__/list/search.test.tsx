import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

async function searchFor(user: ReturnType<typeof userEvent.setup>, term: string) {
  const field = screen.getByRole('textbox', { name: 'Search discharges' })
  await user.clear(field)
  await user.type(field, term)
}

test('narrows the rows by customer name without moving any status count', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Closed \(2\)/))
  await searchFor(user, 'Cargill')

  const table = await screen.findByRole('table', { name: 'Discharges' })
  expect(within(table).getByText('9410003')).toBeInTheDocument()
  expect(within(table).queryByText('9410004')).not.toBeInTheDocument()

  // The badge answers "how much work is in this status", so the search must not move it.
  expect(dischargeTab(/Closed \(2\)/)).toBeInTheDocument()
  expect(dischargeTab(/Planned \(2\)/)).toBeInTheDocument()
  expect(dischargeTab(/Active \(1\)/)).toBeInTheDocument()
})

test('searches the vessel, the dock, and the product as well', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })

  await searchFor(user, 'quai est')
  expect(
    within(await screen.findByRole('table', { name: 'Discharges' })).getByText('MV Ocean Cedar'),
  ).toBeInTheDocument()

  await searchFor(user, 'ORGE')
  expect(
    within(await screen.findByRole('table', { name: 'Discharges' })).getByText('MV Ocean Cedar'),
  ).toBeInTheDocument()
})

test('keeps the search applied when the user switches status', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await searchFor(user, 'Cargill')
  await user.click(dischargeTab(/Planned/))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  expect(screen.getByRole('textbox', { name: 'Search discharges' })).toHaveValue('Cargill')
  expect(within(table).getByText('MV Atlantic Dawn')).toBeInTheDocument()
  expect(within(table).queryByText('MV Baltic Star')).not.toBeInTheDocument()
})

test('says a search found nothing without claiming the status is empty', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await searchFor(user, 'zzzz')

  expect(await screen.findByText('No matching discharges')).toBeInTheDocument()
  expect(screen.queryByText('No active discharges')).not.toBeInTheDocument()
})
