import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

test('shows what identifies and situates the discharge on its row', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Ocean Cedar/ })

  expect(within(row).getByText('9410002')).toBeInTheDocument()
  expect(within(row).getByText('Quai Est')).toBeInTheDocument()
  expect(within(row).getByText(/Soufflet Négoce/)).toBeInTheDocument()
  expect(within(row).getByText(/Cargill France/)).toBeInTheDocument()
  expect(within(row).getByRole('cell', { name: '2' })).toBeInTheDocument()
  expect(within(row).getByRole('cell', { name: '3' })).toBeInTheDocument()
})

// The selected tab already says which status is listed, so repeating it on every row of that tab
// would be the same word down a whole column.
test('does not repeat the status on each row', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })

  expect(within(table).queryByText('Active')).not.toBeInTheDocument()
  expect(within(table).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
})

test('marks a missing vessel IMO as not specified rather than leaving it blank', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Planned/))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Baltic Star/ })

  expect(within(row).getByText('Not specified')).toBeInTheDocument()
})

test('shows zero rather than omitting a discharge with no lot and no shift', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Planned/))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Baltic Star/ })

  expect(within(row).getAllByRole('cell', { name: '0' })).toHaveLength(2)
})
