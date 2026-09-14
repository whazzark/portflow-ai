import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockRestorationRefused, startRestorationFromRecord } from './helpers'

async function submitRestoration(user: ReturnType<typeof userEvent.setup>) {
  const confirmation = await startRestorationFromRecord(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Restore invitation' }))

  return confirmation
}

const NOT_CANCELLED = 'Only a cancelled invitation can be restored'

test.each([
  [
    'an invitation someone else already restored',
    'E_USER_NOT_CANCELLED',
    NOT_CANCELLED,
    409,
    { accessStatus: 'PENDING' },
    "Élodie Fabre's invitation is already pending, so there is nothing to restore. Renew their activation link if they need a new one.",
  ],
  [
    'a user who holds active access',
    'E_USER_NOT_CANCELLED',
    NOT_CANCELLED,
    409,
    { accessStatus: 'ACTIVE' },
    'Élodie Fabre has already activated their access. There is no invitation to restore.',
  ],
  [
    'a user whose access was deactivated',
    'E_USER_NOT_CANCELLED',
    NOT_CANCELLED,
    409,
    { accessStatus: 'DEACTIVATED' },
    "Élodie Fabre's access was deactivated. Reactivate it instead.",
  ],
  [
    'a user who no longer exists',
    'E_USER_NOT_FOUND',
    'User not found',
    404,
    undefined,
    'Élodie Fabre no longer exists. Refresh to see the current users.',
  ],
  [
    'a viewer who may not restore',
    'E_AUTHORIZATION_FAILURE',
    'Access denied',
    403,
    undefined,
    'You are not allowed to restore an invitation.',
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
  mockUsers(ORGANIZATION_ADMIN, USERS)
  mockRestorationRefused(code, message, status, meta)

  renderUsers('/users?status=cancelled')
  await submitRestoration(user)

  expect(await screen.findByText("Unable to restore Élodie Fabre's invitation")).toBeVisible()
  expect(await screen.findByText(expected)).toBeInTheDocument()
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

      return HttpResponse.json({ data: USERS })
    }),
  )
  mockRestorationRefused('E_AUTHORIZATION_FAILURE', 'Access denied', 403)

  renderUsers('/users?status=cancelled')
  const confirmation = await startRestorationFromRecord(user)
  const readsBeforeRefusal = collectionReads
  await user.click(within(confirmation).getByRole('button', { name: 'Restore invitation' }))

  await screen.findByText('You are not allowed to restore an invitation.')
  await waitFor(() => expect(collectionReads).toBeGreaterThan(readsBeforeRefusal))
  expect(screen.getByRole('alertdialog')).toBe(confirmation)
  expect(within(confirmation).getByRole('button', { name: 'Restore invitation' })).toBeEnabled()
  expect(screen.queryByTestId('activation-link')).not.toBeInTheDocument()
})
