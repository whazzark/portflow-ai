import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import {
  EXPIRED_LINK_USER,
  ORGANIZATION_ADMIN,
  USERS_WITH_PENDING_LINKS,
} from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockRenewalSucceeds, openPendingRecordFor } from './helpers'

test.each([
  ['a valid link', 'Karim Lemoine', /^Valid until /],
  ['an expired link', 'Maël Nicolas', /^Expired /],
  ['no link at all', 'Nora Olivier', /^Not issued$/],
])('states the validity of %s on the pending user’s record', async (_label, name, expected) => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, name)

  const field = within(record).getByText('Activation link').closest('div')
  expect(field).not.toBeNull()
  expect(within(field as HTMLElement).getByText(expected)).toBeInTheDocument()
})

test('marks the pending users whose link no longer works, and only them', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=pending')
  const table = await screen.findByRole('table', { name: 'Pending users' })

  expect(within(table).getByRole('columnheader', { name: 'Activation link' })).toBeInTheDocument()
  const rowOf = (name: string) =>
    within(table)
      .getByRole('button', { name: `View user ${name}` })
      .closest('tr') as HTMLElement
  expect(within(rowOf('Maël Nicolas')).getByText('Expired')).toBeInTheDocument()
  expect(within(rowOf('Nora Olivier')).getByText('Not issued')).toBeInTheDocument()
  expect(within(rowOf('Karim Lemoine')).queryByText(/Expired|Not issued/)).toBeNull()
  // A pending user can never owe a password renewal, so that column gives way here.
  expect(within(table).queryByRole('columnheader', { name: 'Password' })).toBeNull()
})

test('shows the activation link column in the pending view only', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=active')
  const table = await screen.findByRole('table', { name: 'Active users' })

  expect(within(table).queryByRole('columnheader', { name: 'Activation link' })).toBeNull()
  expect(within(table).getByRole('columnheader', { name: 'Password' })).toBeInTheDocument()
})

test('clears the mark once the expired link is renewed, without a manual reload', async () => {
  const user = userEvent.setup()
  const administrator = { id: ORGANIZATION_ADMIN.id, firstName: 'Claire', lastName: 'Martin' }
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  mockRenewalSucceeds(EXPIRED_LINK_USER, administrator)

  renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, 'Maël Nicolas')
  await user.click(within(record).getByRole('button', { name: 'Renew activation link' }))

  mockUsers(
    ORGANIZATION_ADMIN,
    USERS_WITH_PENDING_LINKS.map((entry) =>
      entry.id === EXPIRED_LINK_USER.id
        ? ({ ...entry, activationLinkExpiresAt: '2099-06-01T09:00:00.000Z' } as UserDto)
        : entry,
    ),
  )
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Renew' }))
  await screen.findByTestId('activation-link')
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

  const field = within(screen.getByRole('dialog')).getByText('Activation link').closest('div')
  await waitFor(() =>
    expect(within(field as HTMLElement).getByText(/^Valid until /)).toBeInTheDocument(),
  )

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const table = screen.getByRole('table', { name: 'Pending users' })
  expect(within(table).queryByText('Expired')).toBeNull()
})
