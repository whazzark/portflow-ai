import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

test('identifies the discharge by its vessel with the IMO beneath it, and situates it', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Ocean Cedar/ })
  const vessel = within(row).getByRole('link', { name: 'View discharge MV Ocean Cedar' })

  expect(vessel.closest('td')).toHaveTextContent('MV Ocean Cedar9410002')
  expect(within(row).getByText('Quai Est')).toBeInTheDocument()
})

test.each([
  ['Active', /Active/],
  ['Planned', /Planned/],
  ['Closed', /Closed/],
])(
  'gives the IMO no column of its own and drops the lot and shift counts on %s',
  async (_tab, name) => {
    const user = userEvent.setup()
    mockDischarges()

    renderDischarges()
    await screen.findByRole('table', { name: 'Discharges' })
    await user.click(dischargeTab(name))

    const table = await screen.findByRole('table', { name: 'Discharges' })
    for (const header of ['IMO', 'Product lots', 'Shifts']) {
      expect(within(table).queryByRole('columnheader', { name: header })).not.toBeInTheDocument()
    }
  },
)

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
