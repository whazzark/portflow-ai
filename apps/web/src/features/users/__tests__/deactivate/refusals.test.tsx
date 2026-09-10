import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, USERS } from '../support/fixtures'
import {
  mockDeactivationRefused,
  mockUsersWithDeactivation,
  renderUsers,
} from '../support/test-helpers'

const confirmDeactivation = async (user: ReturnType<typeof userEvent.setup>) => {
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))
}

test.each([
  ['E_USER_SELF_DEACTIVATION', /another organization admin/i],
  ['E_USER_PENDING_INVITATION', /cancel their invitation instead/i],
  ['E_USER_CANCELLED_INVITATION', /already withdrawn/i],
  ['E_USER_ALREADY_DEACTIVATED', /already been deactivated/i],
  ['E_USER_NOT_FOUND', /no longer exists/i],
])('reports %s with its own reason', async (code, sentence) => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()
  mockDeactivationRefused(code, 'Refused by the API')

  renderUsers()
  await confirmDeactivation(user)

  expect(await screen.findByText('Unable to deactivate user “Amélie Bernard”')).toBeInTheDocument()
  expect(await screen.findByText(sentence)).toBeInTheDocument()
})

test('keeps the confirmation open on a refusal', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()
  mockDeactivationRefused('E_USER_ALREADY_DEACTIVATED', 'Refused by the API')

  renderUsers()
  await confirmDeactivation(user)

  await screen.findByText('Unable to deactivate user “Amélie Bernard”')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

test('refreshes the collection on a refusal, not only on a success', async () => {
  const user = userEvent.setup()
  let reads = 0
  mockUsersWithDeactivation()
  mockDeactivationRefused('E_USER_ALREADY_DEACTIVATED', 'Refused by the API')
  server.use(
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      reads += 1

      return HttpResponse.json({ data: USERS })
    }),
  )

  renderUsers()
  await waitFor(() => expect(reads).toBe(1))
  await confirmDeactivation(user)

  await waitFor(() => expect(reads).toBeGreaterThan(1))
})

test('falls back to the API sentence for a reason it does not know', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()
  mockDeactivationRefused('E_SOMETHING_NEW', 'A reason this build has never met')

  renderUsers()
  await confirmDeactivation(user)

  expect(await screen.findByText('A reason this build has never met')).toBeInTheDocument()
})
