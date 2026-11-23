import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CustomerDto } from '@/features/customers/types'
import { CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

const THOMAS = { id: 'admin-2', firstName: 'Thomas', lastName: 'Bernard' }

const ARCHIVED_THEN_REACTIVATED: CustomerDto = {
  ...CUSTOMERS[1],
  archivedAt: '2026-06-30T09:05:00.000Z',
  archivedByUserId: THOMAS.id,
  archivedBy: THOMAS,
  archiveComment: 'No discharge planned until next season',
  reactivatedAt: '2026-08-14T14:40:00.000Z',
  reactivationComment: 'New contract for the 2026 season',
}

test('lists the lifecycle history newest first', async () => {
  mockCustomers(undefined, [CUSTOMERS[0], ARCHIVED_THEN_REACTIVATED, CUSTOMERS[2]])

  renderCustomers('/customers?customerId=available-2&mode=view')

  const dialog = await screen.findByRole('dialog', { name: 'Bêta Maritime' })
  const history = within(dialog).getByRole('region', { name: 'History' })
  const entries = within(history).getAllByRole('listitem')

  expect(entries).toHaveLength(2)
  expect(entries[0]).toHaveTextContent('Reactivated')
  expect(entries[0]).toHaveTextContent('Claire Martin')
  expect(entries[0]).toHaveTextContent('“New contract for the 2026 season”')
  expect(entries[1]).toHaveTextContent('Archived')
  expect(entries[1]).toHaveTextContent('Thomas Bernard')
  expect(entries[1]).toHaveTextContent('“No discharge planned until next season”')
  expect(within(dialog).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('says when a customer has no lifecycle history', async () => {
  mockCustomers()

  renderCustomers('/customers?customerId=available-1&mode=view')

  const dialog = await screen.findByRole('dialog', { name: 'Acme Logistics' })
  const history = within(dialog).getByRole('region', { name: 'History' })
  expect(within(history).getByText('No lifecycle history yet.')).toBeInTheDocument()
})

test('offers only reactivation on an archived customer', async () => {
  mockCustomers()

  renderCustomers('/customers?customerId=archived-1&mode=view')

  const dialog = await screen.findByRole('dialog', { name: 'Old Harbor' })
  expect(
    within(dialog).getByText('Status', { selector: 'dt' }).nextElementSibling,
  ).toHaveTextContent('Archived')
  expect(within(dialog).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('names an unknown actor in the history instead of leaving a dash', async () => {
  mockCustomers(undefined, [CUSTOMERS[0], CUSTOMERS[1], { ...CUSTOMERS[2], archivedBy: null }])

  renderCustomers('/customers?customerId=archived-1&mode=view')

  const dialog = await screen.findByRole('dialog', { name: 'Old Harbor' })
  const entry = within(within(dialog).getByRole('region', { name: 'History' })).getByRole(
    'listitem',
  )
  expect(entry).toHaveTextContent('Unknown')
  expect(entry).not.toHaveTextContent('—')
})
