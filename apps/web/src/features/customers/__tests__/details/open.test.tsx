import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('opens the customer panel when clicking any table cell', async () => {
  mockCustomers()

  renderCustomers()
  fireEvent.click(await screen.findByText('Acme Logistics'))

  expect(await screen.findByRole('dialog', { name: 'Acme Logistics' })).toBeInTheDocument()
})

test('summarises the customer in the detail sheet', async () => {
  mockCustomers()

  renderCustomers('/customers?customerId=available-1&mode=view')

  const dialog = await screen.findByRole('dialog', { name: 'Acme Logistics' })
  expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  expect(
    within(dialog).getByText('Status', { selector: 'dt' }).nextElementSibling,
  ).toHaveTextContent('Available')
  expect(
    within(dialog).getByText('Customer code', { selector: 'dt' }).nextElementSibling,
  ).toHaveTextContent('ACME-01')
  expect(within(dialog).getByText('Created')).toBeInTheDocument()
  expect(within(dialog).getByText('Last updated')).toBeInTheDocument()
  expect(within(dialog).queryByRole('heading', { name: 'Discharges' })).not.toBeInTheDocument()
})

test('still reports a customer the list no longer holds', async () => {
  mockCustomers()

  renderCustomers(`/customers?${new URLSearchParams({ customerId: 'unknown', mode: 'view' })}`)

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Unable to load customer')).toBeInTheDocument()
})
