import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

test('carries the selected status and the typed search in the address', async () => {
  const user = userEvent.setup()
  mockDischarges()

  // The test router uses a memory history, so the location lives on the router rather than on
  // `window.location`, which stays empty however the address changes.
  const { router } = renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Closed/))
  await user.type(screen.getByRole('textbox', { name: 'Search discharges' }), 'Cargill')

  expect(router.state.location.searchStr).toContain('status=closed')
  expect(router.state.location.searchStr).toContain('search=Cargill')
})

test('restores the same collection and search from a shared address', async () => {
  mockDischarges()

  // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
  renderDischarges('/discharges?status=closed&search=Cargill')

  const table = await screen.findByRole('table', { name: 'Discharges' })
  expect(dischargeTab(/Closed \(2\)/)).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('textbox', { name: 'Search discharges' })).toHaveValue('Cargill')
  expect(within(table).getByText('9410003')).toBeInTheDocument()
  expect(within(table).queryByText('9410004')).not.toBeInTheDocument()
})

test('falls back to the active collection when the address carries an unknown status', async () => {
  mockDischarges()

  // biome-ignore lint/security/noSecrets: a hand-typed invalid address, not a credential
  renderDischarges('/discharges?status=nope')

  const table = await screen.findByRole('table', { name: 'Discharges' })
  expect(dischargeTab(/Active \(1\)/)).toHaveAttribute('aria-selected', 'true')
  expect(within(table).getByText('MV Ocean Cedar')).toBeInTheDocument()
  expect(screen.queryByText('Not Found')).not.toBeInTheDocument()
})
