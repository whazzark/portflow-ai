import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
import { mockUsers, mockUsersWithDeactivation, renderUsers } from '../support/test-helpers'

const openFromActiveView = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

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

test('offers the deactivation to an organization admin on another active user', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openFromActiveView(user, 'Amélie Bernard')

  expect(within(record).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
})

test('offers it to no one but an organization admin', async () => {
  const user = userEvent.setup()
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const record = await openFromActiveView(user, 'Amélie Bernard')

  expect(within(record).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
})

test('never offers it on the viewer own record', async () => {
  const user = userEvent.setup()
  // The viewer *is* the record: an administrator does not retire their own access.
  mockUsersWithDeactivation({ ...ORGANIZATION_ADMIN, id: 'active-1' }, USERS)

  renderUsers()
  const record = await openFromActiveView(user, 'Amélie Bernard')

  expect(within(record).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
})

test.each([
  ['Pending', 'Chloé Durand'],
  ['Deactivated', 'David Évrard'],
  ['Cancelled', 'Élodie Fabre'],
])('does not offer it on a %s user', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openFromView(user, view, name)

  expect(within(record).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
})
