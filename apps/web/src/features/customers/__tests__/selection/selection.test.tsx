import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('clears the bulk selection from the floating action bar', async () => {
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' }))

  expect(screen.getByRole('toolbar')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' })).not.toBeChecked()
})
