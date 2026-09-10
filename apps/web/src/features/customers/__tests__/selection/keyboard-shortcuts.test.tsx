import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { OBSERVER } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

/**
 * The same contract the warehouse and checkpoint maps already hold, on the customer directory.
 * A selection is a selection wherever it is made; that it happens to be built from table rows
 * rather than from map markers is not something an administrator should have to know.
 */

test('Ctrl+A checks every customer of the active lifecycle tab', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })

  await user.keyboard('{Control>}a{/Control}')

  expect(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' })).toBeChecked()
  expect(within(table).getByRole('checkbox', { name: 'Select customer BETA-02' })).toBeChecked()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  // The archived customer belongs to the other tab, so it is not part of "everything visible".
  expect(screen.getByRole('toolbar')).toHaveTextContent('2 selected')
})

test('Ctrl+A offers the reactivate action from the archived tab', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers('/customers?status=archived')
  await screen.findByRole('table', { name: 'Archived customers' })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('Ctrl+A respects the active search', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'ACME')
  // The search field keeps focus after typing, so the press has to leave it first — which is also
  // what proves the shortcut stays out of the way of selecting text in that field.
  await user.click(screen.getByRole('heading', { name: 'Customers' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByRole('toolbar')).toHaveTextContent('1 selected')
})

test('ignores Ctrl+A while a text field has focus', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })

  await user.click(screen.getByRole('textbox', { name: 'Search customers' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('clears the selection on Escape without leaving the directory', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  await user.keyboard('{Control>}a{/Control}')
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()

  await user.keyboard('{Escape}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Available customers' })).toBeInTheDocument()
})

test('offers no shortcut to an active non-administrator', async () => {
  const user = userEvent.setup()
  mockCustomers(OBSERVER)

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
