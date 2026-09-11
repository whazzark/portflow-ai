import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import { ORGANIZATION_ADMIN, RENEWABLE_USER, USERS_WITH_PENDING_LINKS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import {
  mockRenewalSucceeds,
  NEW_EXPIRY,
  NEW_LINK,
  openPendingRecordFor,
  openPendingRowMenu,
  RENEWED_AT,
} from './helpers'

const ADMINISTRATOR = { id: ORGANIZATION_ADMIN.id, firstName: 'Claire', lastName: 'Martin' }

/** What the collection holds once the renewal landed, exactly as the API would serve it. */
function collectionAfterRenewal(): UserDto[] {
  return USERS_WITH_PENDING_LINKS.map((entry) =>
    entry.id === RENEWABLE_USER.id
      ? ({
          ...entry,
          activationLinkRenewedAt: RENEWED_AT,
          activationLinkRenewedBy: ADMINISTRATOR,
          activationLinkExpiresAt: NEW_EXPIRY,
        } as UserDto)
      : entry,
  )
}

test('presents a user’s earlier renewal in their access history', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, 'Léa Marchand')
  const history = within(record).getByRole('list', { name: 'Access history' })
  const entry = within(history).getByText('Activation link renewed').closest('li')

  expect(entry).not.toBeNull()
  expect(within(entry as HTMLElement).getByText(/by Yann Le Goff/)).toBeInTheDocument()
})

test('hands out the new link once, then returns to the record it was renewed from', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  mockRenewalSucceeds(RENEWABLE_USER, ADMINISTRATOR)

  renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, 'Karim Lemoine')
  await user.click(within(record).getByRole('button', { name: 'Renew activation link' }))

  // The refresh that follows the renewal serves the collection as the API now holds it.
  mockUsers(ORGANIZATION_ADMIN, collectionAfterRenewal())
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Renew' }))

  const link = await screen.findByTestId('activation-link')
  const outcome = screen.getByRole('alertdialog')
  expect(link).toHaveTextContent(NEW_LINK)
  expect(within(outcome).getByRole('button', { name: 'Copy activation link' })).toBeInTheDocument()
  expect(within(outcome).getByText('This link is shown once')).toBeInTheDocument()
  expect(within(outcome).getByText(/previous link no longer works/)).toBeInTheDocument()

  // A secret with no second read is not dismissed by accident.
  await user.keyboard('{Escape}')
  expect(screen.getByTestId('activation-link')).toBeInTheDocument()

  await user.click(within(outcome).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

  expect(screen.queryByText(NEW_LINK)).not.toBeInTheDocument()
  const reopened = screen.getByRole('dialog')
  const history = within(reopened).getByRole('list', { name: 'Access history' })
  await waitFor(() => expect(within(history).getByText('Activation link renewed')).toBeVisible())
  const entry = within(history).getByText('Activation link renewed').closest('li')
  expect(within(entry as HTMLElement).getByText(/by Claire Martin/)).toBeInTheDocument()
})

test('keeps the new link on screen when the record is left by navigating back', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  mockRenewalSucceeds(RENEWABLE_USER, ADMINISTRATOR)

  const { router } = renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, 'Karim Lemoine')
  await user.click(within(record).getByRole('button', { name: 'Renew activation link' }))
  mockUsers(ORGANIZATION_ADMIN, collectionAfterRenewal())
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Renew' }))
  await screen.findByTestId('activation-link')

  // Opening the record pushed a history entry; going back closes the record underneath the outcome.
  // The old link is already dead, so the new one must survive a navigation inside the workbench.
  act(() => router.history.back())
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('userId'))

  expect(screen.getByTestId('activation-link')).toHaveTextContent(NEW_LINK)
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByTestId('activation-link')).not.toBeInTheDocument())
})

test('keeps no copy of the link in the query client once it is acknowledged', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  mockRenewalSucceeds(RENEWABLE_USER, ADMINISTRATOR)

  const { queryClient } = renderUsers('/users?status=pending')
  await openPendingRowMenu('Karim Lemoine')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Renew activation link' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Renew' }),
  )
  await screen.findByTestId('activation-link')
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByTestId('activation-link')).not.toBeInTheDocument())

  // The test client keeps mutations forever by default, so only a mutation that opts out of the
  // cache passes: the secret has no second read, not even from memory.
  await waitFor(() => {
    const held = queryClient
      .getMutationCache()
      .getAll()
      .filter((mutation) => JSON.stringify(mutation.state.data ?? null).includes(NEW_LINK))

    expect(held).toHaveLength(0)
  })
})

test('renews from the row menu and leaves the pending view as it was', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  const calls = mockRenewalSucceeds(RENEWABLE_USER, ADMINISTRATOR)

  renderUsers('/users?status=pending')
  await openPendingRowMenu('Karim Lemoine')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Renew activation link' }))

  const confirmation = await screen.findByRole('alertdialog')
  mockUsers(ORGANIZATION_ADMIN, collectionAfterRenewal())
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Renew' }))

  expect(await screen.findByTestId('activation-link')).toHaveTextContent(NEW_LINK)
  expect(calls).toEqual([RENEWABLE_USER.id])

  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

  // The record was never opened: the row menu is enough on its own.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Pending users' })).toBeInTheDocument()
  expect(screen.queryByText(NEW_LINK)).not.toBeInTheDocument()
})
