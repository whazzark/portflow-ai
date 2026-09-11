import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { ACTIVE_USERS_WITHOUT_LIFECYCLE, OPERATIONS_ADMIN } from '../support/fixtures'
import { mockUsers, mockUsersWithCancellation, renderUsers } from '../support/test-helpers'

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

test('offers the cancellation to an organization admin on a pending user record', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers()
  const record = await openFromView(user, 'Pending', 'Chloé Durand')

  expect(within(record).getByRole('button', { name: 'Cancel invitation' })).toBeInTheDocument()
  // A pending user has never activated their access, so there is nothing to deactivate.
  expect(within(record).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
})

test('offers it from the pending user row menu too', async () => {
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await screen.findByRole('table', { name: 'Pending users' })
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Chloé Durand' }))
  await screen.findByRole('menu')

  expect(screen.getByRole('menuitem', { name: 'Cancel invitation' })).toBeInTheDocument()
})

test.each([
  ['Active', 'Amélie Bernard'],
  ['Deactivated', 'David Évrard'],
  ['Cancelled', 'Élodie Fabre'],
])('never offers it on a user in the %s view', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers()
  const record = await openFromView(user, view, name)

  expect(
    within(record).queryByRole('button', { name: 'Cancel invitation' }),
  ).not.toBeInTheDocument()
})

test('offers it to no one but an organization admin', async () => {
  const user = userEvent.setup()
  // An operations admin consults the active users only: a pending user is never even listed.
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  expect(screen.queryByRole('tab', { name: /Pending/ })).not.toBeInTheDocument()
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))

  expect(
    within(screen.getByRole('dialog')).queryByRole('button', { name: 'Cancel invitation' }),
  ).not.toBeInTheDocument()
})
