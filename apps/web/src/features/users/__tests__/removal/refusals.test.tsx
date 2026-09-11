import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from '../support/fixtures'
import {
  mockRemovalLostRace,
  mockRemovalRefused,
  mockUsersWithRemoval,
  renderUsers,
} from '../support/test-helpers'

const confirmRemoval = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('tab', { name: /Pending/ }))
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: 'View user Chloé Durand' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
  await screen.findByRole('heading', { name: 'Remove user?' })
  await user.click(screen.getByRole('button', { name: 'Remove' }))
}

test.each([
  ['E_USER_ACTIVE_CANNOT_BE_REMOVED', /activated their access, so they are kept\. Deactivate/i],
  ['E_USER_DEACTIVATED_CANNOT_BE_REMOVED', /once held access, so they are kept/i],
  ['E_USER_REFERENCED_CANNOT_BE_REMOVED', /named in operational records/i],
  ['E_USER_NOT_FOUND', /no longer exists/i],
])('reports %s with its own reason', async (code, sentence) => {
  const user = userEvent.setup()
  mockUsersWithRemoval()
  mockRemovalRefused(code, 'Refused by the API')

  renderUsers()
  await confirmRemoval(user)

  expect(await screen.findByText('Unable to remove user “Chloé Durand”')).toBeInTheDocument()
  expect(await screen.findByText(sentence)).toBeInTheDocument()
})

// A referenced user is still pending once the collection refreshes, so the record stays open and the
// confirmation with it: the administrator reads the reason over an unchanged user.
test('keeps the confirmation open over a user the refusal leaves unchanged', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()
  mockRemovalRefused('E_USER_REFERENCED_CANNOT_BE_REMOVED', 'Refused by the API')

  renderUsers()
  await confirmRemoval(user)

  await screen.findByText('Unable to remove user “Chloé Durand”')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

// The invitee activated their access in between: the refusal and the refreshed collection agree, so
// Chloé leaves the pending view, the record closes, and the reason survives as the toast.
test('moves an activated user out of the pending view and closes the record', async () => {
  const user = userEvent.setup()
  mockRemovalLostRace('pending-1')

  renderUsers()
  await confirmRemoval(user)

  expect(await screen.findByText(/Deactivate them instead/i)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Active \(3\)/ })).toBeInTheDocument()
})

// US2 scenario 5: someone else removed Chloé first. The 404 and the refreshed collection agree, so
// the workbench stops presenting her — the record closes and the pending view no longer lists her.
test('stops presenting a user someone else already removed', async () => {
  const user = userEvent.setup()
  let removedElsewhere = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: ORGANIZATION_ADMIN }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json({
        data: removedElsewhere ? USERS.filter((entry) => entry.id !== 'pending-1') : USERS,
      }),
    ),
    http.delete(`${API_BASE_URL}/api/v1/users/:id`, () => {
      removedElsewhere = true

      return HttpResponse.json(
        { error: { code: 'E_USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 },
      )
    }),
  )

  renderUsers()
  await confirmRemoval(user)

  expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'View user Chloé Durand' })).not.toBeInTheDocument()
})

test('refreshes the collection on a refusal, not only on a success', async () => {
  const user = userEvent.setup()
  let reads = 0
  mockUsersWithRemoval()
  mockRemovalRefused('E_USER_ACTIVE_CANNOT_BE_REMOVED', 'Refused by the API')
  server.use(
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      reads += 1

      return HttpResponse.json({ data: USERS })
    }),
  )

  renderUsers()
  await screen.findByRole('tab', { name: /Pending/ })
  const readsBeforeRemoval = reads
  await confirmRemoval(user)

  await screen.findByText('Unable to remove user “Chloé Durand”')
  await waitFor(() => expect(reads).toBeGreaterThan(readsBeforeRemoval))
})
