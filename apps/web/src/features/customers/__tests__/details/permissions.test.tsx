import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { OBSERVER } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('does not expose customer mutations to observers in the detail sheet', async () => {
  mockCustomers(OBSERVER)

  renderCustomers()
  fireEvent.click(await screen.findByRole('button', { name: 'View customer ACME-01' }))

  const dialog = await screen.findByRole('dialog')
  expect((await within(dialog).findAllByText('Acme Logistics')).length).toBeGreaterThan(0)
  expect(within(dialog).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
})

test('does not expose customer creation when an observer opens the create URL directly', async () => {
  mockCustomers(OBSERVER)

  const { router } = renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  router.history.push('/customers?mode=create')

  expect(screen.queryByRole('heading', { name: 'Create customer' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create customer' })).not.toBeInTheDocument()
})

test('closes an inspection URL that has no customer id', async () => {
  mockCustomers()

  const { router } = renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  router.history.push('/customers?mode=view')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('renders the directory read-only for observers', async () => {
  mockCustomers(OBSERVER)

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })

  expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(within(table).queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument()
  expect(screen.queryByRole('toolbar', { name: 'Bulk customer actions' })).toBeNull()
})

test('keeps an observer in the details when the edit URL is typed', async () => {
  mockCustomers(OBSERVER)

  renderCustomers('/customers?customerId=available-1&mode=edit')

  const dialog = await screen.findByRole('dialog', { name: 'Acme Logistics' })
  expect(within(dialog).queryByRole('textbox', { name: 'Customer code' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('still points an observer to the other tab from the no-match state', async () => {
  mockCustomers(OBSERVER)

  renderCustomers('/customers?search=harbor')

  expect(await screen.findByRole('button', { name: 'Show archived' })).toBeInTheDocument()
})
