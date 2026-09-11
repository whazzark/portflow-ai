import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
import { mockUsers, mockUsersWithRemoval, renderUsers } from '../support/test-helpers'

const openFromView = async (
  user: ReturnType<typeof userEvent.setup>,
  view: string,
  name: string,
) => {
  await user.click(await screen.findByRole('tab', { name: new RegExp(view) }))
  const table = await screen.findByRole('table', { name: `${view} users` })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

test('offers it to no one but an organization admin, in no record and no row', async () => {
  // An operations admin consults active users only: pending and cancelled ones never reach them.
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  fireEvent.click(within(table).getByRole('button', { name: 'Actions for Amélie Bernard' }))
  await screen.findByRole('menu')
  expect(screen.queryByRole('menuitem', { name: 'Remove' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('menuitem', { name: 'View' }))
  const record = await screen.findByRole('dialog')
  expect(within(record).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
})

test.each([
  ['Active', 'Bruno Costa'],
  ['Deactivated', 'David Évrard'],
])('offers no removal on an %s user', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  const record = await openFromView(user, view, name)

  expect(within(record).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
})

test('offers the deactivation, not the removal, on an active user', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  const record = await openFromView(user, 'Active', 'Bruno Costa')

  expect(within(record).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
  expect(within(record).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
})

test('never offers it on the viewer own record', async () => {
  const user = userEvent.setup()
  // The viewer *is* the record, and is active by construction: nothing to remove.
  mockUsersWithRemoval({ ...ORGANIZATION_ADMIN, id: 'active-1' }, USERS)

  renderUsers()
  const record = await openFromView(user, 'Active', 'Amélie Bernard')

  expect(within(record).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  expect(within(record).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
})
