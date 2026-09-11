import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import type { UserDto } from '@/features/users/types'
import { USERS } from '../support/fixtures'
import { mockRoleChangeRefused, mockUsers, renderUsers, selectRole } from '../support/test-helpers'

const target = USERS.find((entry) => entry.id === 'active-2') as UserDto

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 })

// The interface stays honest about what the API would accept; the API remains authoritative. The
// identity of a deactivated user stays correctable, so the panel opens — without a role to pick.
test('offers no role change on a deactivated user, and says why', async () => {
  mockUsers()

  renderUsers('/users?status=deactivated&userId=deactivated-1&mode=edit')
  const panel = await screen.findByRole('dialog')
  await within(panel).findByRole('heading', { name: 'Edit user' })

  expect(within(panel).queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument()
  expect(within(panel).getByText(/reactivate the user first/i)).toBeInTheDocument()
})

test('surfaces a refusal and leaves the displayed role unchanged', async () => {
  const user = setupUser()
  mockUsers()
  mockRoleChangeRefused()

  renderUsers('/users?userId=active-2&mode=edit')
  const panel = await screen.findByRole('dialog')
  await screen.findByRole('combobox', { name: 'Role' })

  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  expect(
    (await screen.findAllByText(/Deactivated users cannot have their role changed/i)).length,
  ).toBeGreaterThan(0)

  // The panel stays open on the refused selection, so the administrator can correct it.
  expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument()

  await user.click(within(panel).getByRole('button', { name: 'Back to details' }))
  const record = await screen.findByRole('dialog')
  await waitFor(() => expect(within(record).getByText('Operations lead')).toBeInTheDocument())
  expect(target.role).toBe('OPERATIONS_LEAD')
}, 15000)
