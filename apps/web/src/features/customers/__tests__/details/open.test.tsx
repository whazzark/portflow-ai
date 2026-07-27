import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('opens the customer panel when clicking any table cell', async () => {
  mockCustomers()

  renderCustomers()
  fireEvent.click(await screen.findByText('Acme Logistics'))

  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('ACME-01')).toBeInTheDocument()
})
