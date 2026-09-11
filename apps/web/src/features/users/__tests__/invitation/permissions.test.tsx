import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_USERS_WITHOUT_LIFECYCLE, OPERATIONS_ADMIN } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

test('offers no invitation entry point to an operations admin', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.queryByRole('button', { name: 'Invite user' })).not.toBeInTheDocument()
})

test('opens no invitation panel for a viewer who may not invite, even from the URL', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers('/users?mode=create')
  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
