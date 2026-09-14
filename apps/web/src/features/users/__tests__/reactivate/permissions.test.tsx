import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { ACTIVE_USERS_WITHOUT_LIFECYCLE, OPERATIONS_ADMIN } from '../support/fixtures'
import { mockUsers, mockUsersWithReactivation, renderUsers } from '../support/test-helpers'

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

test('offers the reactivation to an organization admin on a deactivated user', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  const record = await openFromView(user, 'Deactivated', 'David Évrard')

  expect(within(record).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
})

test('offers it to no one but an organization admin', async () => {
  const user = userEvent.setup()
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))

  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test.each([
  ['Active', 'Amélie Bernard'],
  ['Pending', 'Chloé Durand'],
  ['Cancelled', 'Élodie Fabre'],
])('does not offer it on an %s user', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  const record = await openFromView(user, view, name)

  expect(within(record).queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})
