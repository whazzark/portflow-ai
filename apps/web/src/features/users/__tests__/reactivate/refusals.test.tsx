import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, USERS } from '../support/fixtures'
import {
  mockReactivationLostRace,
  mockReactivationRefused,
  mockUsersWithReactivation,
  renderUsers,
} from '../support/test-helpers'

const confirmReactivation = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('tab', { name: /Deactivated/ }))
  const table = await screen.findByRole('table', { name: 'Deactivated users' })
  await user.click(within(table).getByRole('button', { name: 'View user David Évrard' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
}

test.each([
  ['E_USER_ALREADY_ACTIVE', /already active/i],
  ['E_USER_PENDING_INVITATION', /renew their activation link instead/i],
  ['E_USER_CANCELLED_INVITATION', /restore it instead/i],
  ['E_USER_NOT_FOUND', /no longer exists/i],
])('reports %s with its own reason', async (code, sentence) => {
  const user = userEvent.setup()
  mockUsersWithReactivation()
  mockReactivationRefused(code, 'Refused by the API')

  renderUsers()
  await confirmReactivation(user)

  expect(await screen.findByText('Unable to reactivate user “David Évrard”')).toBeInTheDocument()
  expect(await screen.findByText(sentence)).toBeInTheDocument()
})

test('keeps the confirmation open on a refusal the collection still contradicts', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()
  mockReactivationRefused('E_USER_ALREADY_ACTIVE', 'Refused by the API')

  renderUsers()
  await confirmReactivation(user)

  await screen.findByText('Unable to reactivate user “David Évrard”')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

// Someone else reactivated David first, and the refreshed collection agrees: he leaves the
// deactivated users, so the record closes with its confirmation. What must survive is the reason.
test('closes the record on a refusal whose collection has moved on', async () => {
  const user = userEvent.setup()
  mockReactivationLostRace('deactivated-1')

  renderUsers()
  await confirmReactivation(user)

  expect(await screen.findByText(/already active/i)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Deactivated \(0\)/ })).toBeInTheDocument()
})

test('refreshes the collection on a refusal, not only on a success', async () => {
  const user = userEvent.setup()
  let reads = 0
  mockUsersWithReactivation()
  mockReactivationRefused('E_USER_ALREADY_ACTIVE', 'Refused by the API')
  server.use(
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      reads += 1

      return HttpResponse.json({ data: USERS })
    }),
  )

  renderUsers()
  await waitFor(() => expect(reads).toBe(1))
  await confirmReactivation(user)

  await waitFor(() => expect(reads).toBeGreaterThan(1))
})
