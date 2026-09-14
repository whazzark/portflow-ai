import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import { formatDateTime } from '@/helpers/dates'
import { ORGANIZATION_ADMIN, RESTORED_USER, USERS, USERS_WITH_RESTORED } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

const openRestoredRecord = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

const entryFor = (history: HTMLElement, label: string) =>
  within(history).getByText(label).closest('li') as HTMLElement

test('tells how the invitation got here, oldest first, with both administrators’ words', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESTORED)

  renderUsers('/users?status=pending')
  const record = await openRestoredRecord(user, 'Inès Garnier')
  const history = within(record).getByRole('list', { name: 'Access history' })

  const labels = within(history)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent)
  expect(labels).toEqual(['Invited', 'Cancelled', 'Invitation restored'])
  expect(within(entryFor(history, 'Cancelled')).getByText('“Start date postponed.”')).toBeVisible()
  const restoration = entryFor(history, 'Invitation restored')
  expect(within(restoration).getByText('“Start date confirmed.”')).toBeVisible()
  expect(within(restoration).getByText('by Yann Le Goff')).toBeVisible()

  // The link the restoration issued is the one the record reports on.
  expect(within(record).getByText(/^Valid until/)).toBeInTheDocument()
})

test('shows no comment line under a restoration that carried none', async () => {
  const user = userEvent.setup()
  const withoutComment = { ...RESTORED_USER, invitationRestorationComment: null } as UserDto
  mockUsers(ORGANIZATION_ADMIN, [...USERS, withoutComment])

  renderUsers('/users?status=pending')
  const record = await openRestoredRecord(user, 'Inès Garnier')
  const history = within(record).getByRole('list', { name: 'Access history' })

  const restoration = entryFor(history, 'Invitation restored')
  expect(within(restoration).queryByText(/^“.*”$/)).not.toBeInTheDocument()
})

test('keeps the original invitation in the pending view’s Invited column', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESTORED)

  renderUsers('/users?status=pending')
  const table = await screen.findByRole('table', { name: 'Pending users' })
  const row = within(table).getByText('Inès Garnier').closest('tr') as HTMLElement

  // The invitation's date and administrator — not the later restoration's date.
  expect(within(row).getByText(formatDateTime(RESTORED_USER.invitedAt ?? null))).toBeInTheDocument()
  expect(within(row).getByText('by Yann Le Goff')).toBeInTheDocument()
  expect(
    within(row).queryByText(formatDateTime(RESTORED_USER.invitationRestoredAt ?? null)),
  ).not.toBeInTheDocument()
})
