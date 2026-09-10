import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

test('opens on the active discharges and shows every status count at once', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })

  expect(dischargeTab(/Active \(1\)/)).toHaveAttribute('aria-selected', 'true')
  expect(dischargeTab(/Planned \(2\)/)).toBeInTheDocument()
  expect(dischargeTab(/Closed \(2\)/)).toBeInTheDocument()
  expect(within(table).getByText('MV Ocean Cedar')).toBeInTheDocument()
  expect(within(table).queryByText('MV Atlantic Dawn')).not.toBeInTheDocument()
})

test('lists only the selected status when the user switches tab', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Planned \(2\)/))

  const planned = await screen.findByRole('table', { name: 'Discharges' })
  expect(within(planned).getByText('MV Atlantic Dawn')).toBeInTheDocument()
  expect(within(planned).getByText('MV Baltic Star')).toBeInTheDocument()
  expect(within(planned).queryByText('MV Ocean Cedar')).not.toBeInTheDocument()

  await user.click(dischargeTab(/Closed \(2\)/))
  const closed = await screen.findByRole('table', { name: 'Discharges' })
  expect(within(closed).getAllByText('MV Loire Star')).toHaveLength(2)
  expect(within(closed).queryByText('MV Atlantic Dawn')).not.toBeInTheDocument()
})

test('keeps a status with no discharge selectable and explicit', async () => {
  const user = userEvent.setup()
  mockDischarges({ discharges: [] })

  renderDischarges()

  expect(await screen.findByText('No active discharges')).toBeInTheDocument()
  expect(dischargeTab(/Planned \(0\)/)).toBeInTheDocument()
  await user.click(dischargeTab(/Closed \(0\)/))
  expect(await screen.findByText('No closed discharges')).toBeInTheDocument()
})
