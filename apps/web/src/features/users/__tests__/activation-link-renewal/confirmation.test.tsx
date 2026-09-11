import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ORGANIZATION_ADMIN, RENEWABLE_USER, USERS_WITH_PENDING_LINKS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockRenewalPending, mockRenewalSucceeds, openPendingRecordFor } from './helpers'

async function openConfirmation(user: ReturnType<typeof userEvent.setup>) {
  const record = await openPendingRecordFor(user, 'Karim Lemoine')
  await user.click(within(record).getByRole('button', { name: 'Renew activation link' }))

  return screen.getByRole('alertdialog')
}

test('names the user and warns that the link already handed out will stop working', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)

  renderUsers('/users?status=pending')
  const confirmation = await openConfirmation(user)

  expect(
    within(confirmation).getByRole('heading', { name: 'Renew activation link' }),
  ).toBeInTheDocument()
  expect(within(confirmation).getByText(/Karim Lemoine/)).toBeInTheDocument()
  expect(within(confirmation).getByText(/will stop working/)).toBeInTheDocument()
  expect(within(confirmation).getByText(/shown once/)).toBeInTheDocument()
})

test('sends nothing when the confirmation is cancelled', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  const calls = mockRenewalSucceeds(RENEWABLE_USER, ORGANIZATION_ADMIN)

  renderUsers('/users?status=pending')
  const confirmation = await openConfirmation(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(calls).toHaveLength(0)
  // The record it was opened from is still there, unchanged.
  expect(within(screen.getByRole('dialog')).getByText('karim.lemoine@portflow.test')).toBeVisible()
})

test('prevents a second submission while the renewal is in flight', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  const renewal = mockRenewalPending(RENEWABLE_USER, ORGANIZATION_ADMIN)

  renderUsers('/users?status=pending')
  const confirmation = await openConfirmation(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Renew' }))

  const inFlight = await within(confirmation).findByRole('button', { name: 'Renewing…' })
  expect(inFlight).toBeDisabled()
  await user.click(inFlight)
  expect(renewal.calls).toHaveLength(1)

  renewal.release()
  await screen.findByTestId('activation-link')
  expect(renewal.calls).toHaveLength(1)
})

test('cannot be dismissed while the renewal is in flight, so its link is never thrown away', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  const renewal = mockRenewalPending(RENEWABLE_USER, ORGANIZATION_ADMIN)

  renderUsers('/users?status=pending')
  const confirmation = await openConfirmation(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Renew' }))
  await within(confirmation).findByRole('button', { name: 'Renewing…' })

  // Once submitted, the server may already have retired the previous link: leaving now would
  // discard the only link that works.
  expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(screen.getByRole('alertdialog')).toBe(confirmation)

  renewal.release()
  expect(await screen.findByTestId('activation-link')).toBeInTheDocument()
})
