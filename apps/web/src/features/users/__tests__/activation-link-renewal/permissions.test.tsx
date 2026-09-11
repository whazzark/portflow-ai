import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

// An operations admin is not tested here on purpose: the API never serves them a pending user, so a
// workbench test could only pass vacuously. `helpers/user-permissions.test.ts` covers their role.
import { ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { openPendingRecordFor, openPendingRowMenu } from './helpers'

const RENEW = 'Renew activation link'

test('offers the renewal on a pending user’s record to an organization admin', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, 'Karim Lemoine')

  expect(within(record).getByRole('button', { name: RENEW })).toBeInTheDocument()
})

test('offers the renewal from a pending user’s row menu to an organization admin', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=pending')
  await openPendingRowMenu('Karim Lemoine')

  expect(screen.getByRole('menuitem', { name: RENEW })).toBeInTheDocument()
})

test.each([
  ['an active user', 'active', 'Active users', 'Bruno Costa'],
  ['a deactivated user', 'deactivated', 'Deactivated users', 'David Évrard'],
  ['a cancelled user', 'cancelled', 'Cancelled users', 'Élodie Fabre'],
])('does not offer the renewal on %s', async (_label, status, tableName, name) => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers(`/users?status=${status}`)
  const table = await screen.findByRole('table', { name: tableName })

  fireEvent.click(within(table).getByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
  expect(screen.queryByRole('menuitem', { name: RENEW })).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: RENEW })).toBeNull()
})
