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

test('reports no result count beside the search, only the status totals on the tabs', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await searchFor(user, 'Cargill')

  expect(screen.queryByText(/\b\d+ (results?|discharges?)\b/i)).not.toBeInTheDocument()
  expect(dischargeTab(/Active \(1\)/)).toBeInTheDocument()
  expect(dischargeTab(/Planned \(2\)/)).toBeInTheDocument()
  expect(dischargeTab(/Closed \(2\)/)).toBeInTheDocument()
})

test('names the search that matched nothing and the fields it looked in', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await searchFor(user, 'zzz')

  expect(await screen.findByText('No matching discharges')).toBeInTheDocument()
  expect(
    screen.getByText(
      'No active discharge matches “zzz”. Check the vessel name, IMO, dock, customer, or product.',
    ),
  ).toBeInTheDocument()
  // The totals are the status's, whatever the search found.
  expect(dischargeTab(/Active \(1\)/)).toBeInTheDocument()
})

test('clears a search that matched nothing in one action', async () => {
  const user = userEvent.setup()
  mockDischarges()

  const { router } = renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await searchFor(user, 'zzz')
  await user.click(await screen.findByRole('button', { name: 'Clear search' }))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  expect(within(table).getByText('MV Ocean Cedar')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Search discharges' })).toHaveValue('')
  // Cleared, the search leaves the address entirely rather than lingering as an empty `search=`.
  expect(router.state.location.searchStr).not.toContain('search=')
})

test('offers no Clear search on a status that is simply empty', async () => {
  mockDischarges({ discharges: [] })

  renderDischarges()

  expect(await screen.findByText('No active discharges')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
})
