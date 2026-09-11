import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockRenewalRefused, mockRenewalUnreachable, openPendingRecordFor } from './helpers'

async function submitRenewalFor(user: ReturnType<typeof userEvent.setup>) {
  const record = await openPendingRecordFor(user, 'Karim Lemoine')
  await user.click(within(record).getByRole('button', { name: 'Renew activation link' }))

  const confirmation = screen.getByRole('alertdialog')
  await user.click(within(confirmation).getByRole('button', { name: 'Renew' }))

  return confirmation
}

const NOT_PENDING = "Only a pending user's activation link can be renewed"

test.each([
  [
    'a user who activated in the meantime',
    'E_USER_NOT_PENDING',
    NOT_PENDING,
    409,
    { accessStatus: 'ACTIVE' },
    'Karim Lemoine has already activated their access. Reset their password if their credential needs replacing.',
  ],
  [
    'a user deactivated in the meantime',
    'E_USER_NOT_PENDING',
    NOT_PENDING,
    409,
    { accessStatus: 'DEACTIVATED' },
    "Karim Lemoine's access was deactivated. Reactivate it instead.",
  ],
  [
    'a user whose invitation was cancelled in the meantime',
    'E_USER_NOT_PENDING',
    NOT_PENDING,
    409,
    { accessStatus: 'CANCELLED' },
    "Karim Lemoine's invitation was cancelled. Restore it instead.",
  ],
  [
    'a user who no longer exists',
    'E_USER_NOT_FOUND',
    'User not found',
    404,
    undefined,
    'Karim Lemoine no longer exists. Refresh to see the current users.',
  ],
  [
    'a viewer who may not renew',
    'E_AUTHORIZATION_FAILURE',
    'Access denied',
    403,
    undefined,
    'You are not allowed to renew an activation link.',
  ],
  [
    'a refusal introduced later',
    'E_SOMETHING_NEW',
    'The server said something new',
    409,
    undefined,
    'The server said something new',
  ],
])('reports %s with its own reason', async (_label, code, message, status, meta, expected) => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  mockRenewalRefused(code, message, status, meta)

  renderUsers('/users?status=pending')
  await submitRenewalFor(user)

  expect(await screen.findByText("Unable to renew Karim Lemoine's activation link")).toBeVisible()
  expect(await screen.findByText(expected)).toBeInTheDocument()
})

test('reports an unreachable server as something to retry', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_PENDING_LINKS)
  mockRenewalUnreachable()

  renderUsers('/users?status=pending')
  await submitRenewalFor(user)

  expect(await screen.findByText(/try again/i)).toBeInTheDocument()
})

test('keeps the confirmation open after a refusal, and refreshes the collection', async () => {
  const user = userEvent.setup()
  let collectionReads = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: ORGANIZATION_ADMIN }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      collectionReads += 1

      return HttpResponse.json({ data: USERS_WITH_PENDING_LINKS })
    }),
  )
  mockRenewalRefused('E_USER_NOT_FOUND', 'User not found', 404)

  renderUsers('/users?status=pending')
  const record = await openPendingRecordFor(user, 'Karim Lemoine')
  await user.click(within(record).getByRole('button', { name: 'Renew activation link' }))
  const confirmation = screen.getByRole('alertdialog')
  const readsBeforeRefusal = collectionReads
  await user.click(within(confirmation).getByRole('button', { name: 'Renew' }))

  await screen.findByText(/no longer exists/)
  await waitFor(() => expect(collectionReads).toBeGreaterThan(readsBeforeRefusal))
  expect(screen.getByRole('alertdialog')).toBe(confirmation)
  expect(within(confirmation).getByRole('button', { name: 'Renew' })).toBeEnabled()
  expect(screen.queryByTestId('activation-link')).not.toBeInTheDocument()
})
