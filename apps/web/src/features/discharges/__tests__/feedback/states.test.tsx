import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

test('names the status an empty collection belongs to', async () => {
  const user = userEvent.setup()
  mockDischarges({ discharges: [] })

  renderDischarges()
  expect(await screen.findByText('No active discharges')).toBeInTheDocument()

  await user.click(dischargeTab(/Planned/))
  expect(await screen.findByText('No planned discharges')).toBeInTheDocument()
})

test('offers no create action on an empty collection', async () => {
  mockDischarges({ discharges: [] })

  renderDischarges()
  await screen.findByText('No active discharges')

  expect(screen.queryByRole('button', { name: /create|prepare|new/i })).not.toBeInTheDocument()
})

test('distinguishes a search with no match from an empty status', async () => {
  const user = userEvent.setup()
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.type(screen.getByRole('textbox', { name: 'Search discharges' }), 'zzzz')

  expect(await screen.findByText('No matching discharges')).toBeInTheDocument()
  expect(screen.queryByText('No active discharges')).not.toBeInTheDocument()
})
