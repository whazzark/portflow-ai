import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  ORGANIZATION_ADMIN,
  RESET_USER,
  RESETTABLE_USER,
  USERS_WITH_RESET,
} from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockResetSucceeds, openRecordFor } from './helpers'

test('presents the outstanding renewal in the record of a user already reset', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  const record = await openRecordFor(user, 'Gaël Hamon')

  expect(within(record).getByText('Renewal required')).toBeInTheDocument()
})

test('presents the dated, attributed reset in the access history', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  const record = await openRecordFor(user, 'Gaël Hamon')
  const history = within(record).getByRole('list', { name: 'Access history' })

  // Scoped to its own entry: the fixture attributes several events to the same administrator, so a
  // history-wide match would pass even if the reset carried no administrator at all.
  const resetEntry = within(history).getByText('Password reset').closest('li')

  expect(resetEntry).not.toBeNull()
  expect(within(resetEntry as HTMLElement).getByText(/by Yann Le Goff/)).toBeInTheDocument()
})

test('shows no reset entry for a user who has never been reset', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  const record = await openRecordFor(user, 'Inès Joly')

  // Unrecorded events are absent, never presented as an empty value.
  expect(within(record).queryByText('Password reset')).not.toBeInTheDocument()
})

test('lets an organization admin tell who owes a renewal without opening a record', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })

  expect(within(table).getAllByText('Renewal required')).toHaveLength(1)
})

test('reflects the reset in the record and the collection without a manual reload', async () => {
  const user = userEvent.setup()
  let collection = USERS_WITH_RESET
  mockUsers(ORGANIZATION_ADMIN, collection)
  mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  const record = await openRecordFor(user, 'Inès Joly')
  await user.click(within(record).getByRole('button', { name: 'Reset password' }))

  // The collection the refresh will return now carries the requirement, exactly as the API would.
  collection = USERS_WITH_RESET.map((entry) =>
    entry.id === RESETTABLE_USER.id
      ? {
          ...entry,
          passwordRenewalRequired: true,
          passwordResetAt: '2026-09-10T08:00:00.000Z',
          passwordResetBy: { id: ORGANIZATION_ADMIN.id, firstName: 'Claire', lastName: 'Martin' },
        }
      : entry,
  )
  mockUsers(ORGANIZATION_ADMIN, collection)

  const confirmation = screen.getByRole('alertdialog')
  await user.click(within(confirmation).getByRole('button', { name: 'Reset password' }))

  // Both surfaces are modal, so they are asserted in the order they can be reached: the
  // confirmation closes on success, revealing the record, and the record closes to reveal the
  // collection. Neither assertion involves a manual reload — the invalidated collection is what
  // feeds both.
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

  const refreshedRecord = screen.getByRole('dialog')
  await waitFor(() =>
    expect(within(refreshedRecord).getByText('Renewal required')).toBeInTheDocument(),
  )

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  const table = await screen.findByRole('table', { name: 'Active users' })
  await waitFor(() => expect(within(table).getAllByText('Renewal required')).toHaveLength(2))
})

test('reports the reset once it succeeds', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  const record = await openRecordFor(user, 'Inès Joly')
  await user.click(within(record).getByRole('button', { name: 'Reset password' }))

  const confirmation = screen.getByRole('alertdialog')
  await user.click(within(confirmation).getByRole('button', { name: 'Reset password' }))

  expect(await screen.findByText(/must choose a new password/i)).toBeInTheDocument()
  expect(RESET_USER.passwordRenewalRequired).toBe(true)
})
