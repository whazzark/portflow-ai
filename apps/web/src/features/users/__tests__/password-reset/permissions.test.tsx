import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  RESET_USERS_WITHOUT_LIFECYCLE,
  USERS_WITH_RESET,
} from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { openRecordFor } from './helpers'

test('offers the reset to an organization admin on an active user', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  const record = await openRecordFor(user, 'Inès Joly')

  expect(within(record).getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
})

test('offers no reset to an operations admin', async () => {
  const user = userEvent.setup()
  mockUsers(OPERATIONS_ADMIN, RESET_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const record = await openRecordFor(user, 'Inès Joly')

  expect(within(record).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
})

test.each([
  ['a pending user', 'Chloé Durand', 'Pending users'],
  ['a deactivated user', 'David Évrard', 'Deactivated users'],
  ['a cancelled user', 'Élodie Fabre', 'Cancelled users'],
])('offers no reset on %s', async (_label, name, tableName) => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers(`/users?status=${tableName.split(' ')[0].toLowerCase()}`)
  const record = await openRecordFor(user, name, tableName)

  expect(within(record).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
})

// Requiring oneself to renew is a self-service password change under another name, which the API
// refuses; the workbench must not offer what the API would refuse.
test('offers no reset on the administrator’s own record', async () => {
  const user = userEvent.setup()
  const self = { ...USERS_WITH_RESET[0], id: ORGANIZATION_ADMIN.id }
  mockUsers(ORGANIZATION_ADMIN, [self, ...USERS_WITH_RESET.slice(1)])

  renderUsers()
  const record = await openRecordFor(user, `${self.firstName} ${self.lastName}`)

  expect(within(record).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
})

test('discloses no outstanding renewal to an operations admin', async () => {
  mockUsers(OPERATIONS_ADMIN, RESET_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.queryByText('Renewal required')).not.toBeInTheDocument()
})
