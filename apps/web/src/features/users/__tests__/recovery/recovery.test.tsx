import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from '../support/fixtures'
import { mockUsersRefused, renderUsers } from '../support/test-helpers'

test('shows a failure rather than an empty collection when users cannot be loaded', async () => {
  mockUsersRefused(ORGANIZATION_ADMIN, 500)

  renderUsers()

  expect(await screen.findByText(/Unable to load users/i)).toBeInTheDocument()
  // Never an empty collection, and never a zero count that would read as "no user here".
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('tablist', { name: 'User access status' })).not.toBeInTheDocument()
  expect(screen.queryByText(/No active users/)).not.toBeInTheDocument()
  expect(screen.queryByText(/\(0\)/)).not.toBeInTheDocument()
})

test('recovers the collection through the retry once the failure is resolved', async () => {
  const user = userEvent.setup()
  let failing = true

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: ORGANIZATION_ADMIN }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      if (failing) {
        return HttpResponse.json(
          { error: { code: 'E_INTERNAL_ERROR', message: 'Unavailable' } },
          { status: 500 },
        )
      }

      return HttpResponse.json({ data: USERS })
    }),
  )

  renderUsers()

  await screen.findByText(/Unable to load users/i)

  failing = false
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  // The collection loads without a new sign-in: the session was never the problem.
  expect(await screen.findByRole('table', { name: 'Active users' })).toBeInTheDocument()
  expect(screen.queryByText(/Unable to load users/i)).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Active \(2\)/ })).toBeInTheDocument()
})
