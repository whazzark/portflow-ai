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
