import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ACTIVE_USERS_WITHOUT_LIFECYCLE, OPERATIONS_ADMIN } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

const asOperationsAdmin = (path = '/users') => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  return renderUsers(path)
}

test('offers no role change to an operations admin', async () => {
  asOperationsAdmin('/users?userId=active-2')
  const record = await screen.findByRole('dialog')

  expect(within(record).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(within(record).queryByRole('button', { name: 'Change role' })).not.toBeInTheDocument()
})

// Gating the mode in the component keeps the interface honest; the API stays authoritative.
test('opens the read-only record when an operations admin asks for the edit mode', async () => {
  asOperationsAdmin('/users?userId=active-2&mode=edit')
  await screen.findByRole('dialog')

  expect(screen.queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Back to details' })).not.toBeInTheDocument()
})

test('shows an operations admin the role without an action beside it', async () => {
  asOperationsAdmin('/users?userId=active-2')
  const record = await screen.findByRole('dialog')

  expect(within(record).getByText('Operations lead')).toBeInTheDocument()
  expect(within(record).queryByText(/reactivate the user first/i)).not.toBeInTheDocument()
})
