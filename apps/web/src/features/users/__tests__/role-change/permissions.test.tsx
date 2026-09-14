import { screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { UserDto } from '@/features/users/types'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
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

/**
 * GH-29 FR-010: the API refuses a self-role change whatever the interface does, and the interface
 * never offers one — not even to an administrator who types the edit mode on their own record.
 */
test('offers no role control on the viewer’s own record, even when the mode is typed by hand', async () => {
  const ownRecord = {
    ...USERS[0],
    id: ORGANIZATION_ADMIN.id,
    firstName: ORGANIZATION_ADMIN.firstName,
    lastName: ORGANIZATION_ADMIN.lastName,
    email: ORGANIZATION_ADMIN.email,
    role: 'ORGANIZATION_ADMIN',
  } as UserDto
  mockUsers(ORGANIZATION_ADMIN, [ownRecord, USERS[1]])

  renderUsers(`/users?userId=${ORGANIZATION_ADMIN.id}&mode=edit`)
  const record = await screen.findByRole('dialog')

  await waitFor(() =>
    expect(
      within(record).getByRole('heading', { name: new RegExp(ORGANIZATION_ADMIN.firstName) }),
    ).toBeInTheDocument(),
  )
  expect(within(record).queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument()
  expect(within(record).queryByRole('heading', { name: 'Edit user' })).not.toBeInTheDocument()
})

test('shows an operations admin the role without an action beside it', async () => {
  asOperationsAdmin('/users?userId=active-2')
  const record = await screen.findByRole('dialog')

  expect(within(record).getByText('Operations lead')).toBeInTheDocument()
  expect(within(record).queryByText(/reactivate the user first/i)).not.toBeInTheDocument()
})
