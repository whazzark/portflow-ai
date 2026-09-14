import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_USERS_WITHOUT_LIFECYCLE, OPERATIONS_ADMIN } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { CANCELLED_USER, mockUsersWithRestoration } from './helpers'

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

// The row menu's offer is asserted with the row menu itself, in `row-menu.test.tsx`.

test('offers the restoration to an organization admin on a cancelled user record', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers()
  const record = await openFromView(user, 'Cancelled', CANCELLED_USER)

  expect(within(record).getByRole('button', { name: 'Restore invitation' })).toBeInTheDocument()
})

test.each([
  ['Active', 'Amélie Bernard'],
  ['Pending', 'Chloé Durand'],
  ['Deactivated', 'David Évrard'],
])('never offers it on a user in the %s view', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers()
  const record = await openFromView(user, view, name)

  expect(
    within(record).queryByRole('button', { name: 'Restore invitation' }),
  ).not.toBeInTheDocument()
})

test('offers it to no one but an organization admin', async () => {
  const user = userEvent.setup()
  // An operations admin consults the active users only: a cancelled user is never even listed.
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  expect(screen.queryByRole('tab', { name: /Cancelled/ })).not.toBeInTheDocument()
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))

  expect(
    within(screen.getByRole('dialog')).queryByRole('button', { name: 'Restore invitation' }),
  ).not.toBeInTheDocument()
})
