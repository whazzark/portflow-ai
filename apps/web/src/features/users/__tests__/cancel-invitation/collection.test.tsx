import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { formatDateTime } from '@/helpers/dates'
import { mockUsers, mockUsersWithCancellation, renderUsers } from '../support/test-helpers'

const columnHeaders = (table: HTMLElement) =>
  within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)

test('shows the cancellation comment in place of the password in the cancelled view', async () => {
  mockUsers()

  renderUsers('/users?status=cancelled')
  const table = await screen.findByRole('table', { name: 'Cancelled users' })

  const headers = columnHeaders(table)
  expect(headers).toContain('Comment')
  expect(headers).not.toContain('Password')
  const row = within(table).getByRole('row', { name: /Élodie Fabre/ })
  expect(within(row).getByText('Took a position elsewhere before starting.')).toBeInTheDocument()
})

// A pending user has not chosen a password yet either, so that view shows when each invitation was
// issued instead: the date that tells an administrator which invitations have gone stale.
test('shows when and by whom each user was invited in place of the password in the pending view', async () => {
  mockUsers()

  renderUsers('/users?status=pending')
  const table = await screen.findByRole('table', { name: 'Pending users' })

  const headers = columnHeaders(table)
  expect(headers).toContain('Invited')
  expect(headers).not.toContain('Password')
  const row = within(table).getByRole('row', { name: /Chloé Durand/ })
  expect(within(row).getByText(formatDateTime('2026-03-01T10:00:00.000Z'))).toBeInTheDocument()
  expect(within(row).getByText('by Yann Le Goff')).toBeInTheDocument()
})

test('keeps the password column in the active and deactivated views', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  for (const view of ['Active', 'Deactivated']) {
    await user.click(await screen.findByRole('tab', { name: new RegExp(view) }))
    const table = await screen.findByRole('table', { name: `${view} users` })

    expect(columnHeaders(table)).toContain('Password')
    expect(columnHeaders(table)).not.toContain('Comment')
    expect(columnHeaders(table)).not.toContain('Invited')
  }
})

test('lists a just-cancelled user with the comment they were cancelled with', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  const pending = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(pending).getByRole('button', { name: 'View user Chloé Durand' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel invitation' }),
  )
  const dialog = await screen.findByRole('alertdialog')
  await user.type(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), 'No show.')
  await user.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Cancelled \(2\)/ })).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Cancelled \(2\)/ }))
  const cancelled = await screen.findByRole('table', { name: 'Cancelled users' })
  const row = within(cancelled).getByRole('row', { name: /Chloé Durand/ })
  expect(within(row).getByText('No show.')).toBeInTheDocument()
})
