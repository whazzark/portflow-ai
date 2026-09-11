import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { UserDto, UserRole } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, USERS } from '../support/fixtures'
import { mockUsers, renderUsers, selectRole } from '../support/test-helpers'

const target = USERS.find((entry) => entry.id === 'active-2') as UserDto

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 })

const openPanel = async () => {
  renderUsers('/users?userId=active-2&mode=edit')
  const panel = await screen.findByRole('dialog')
  await screen.findByRole('combobox', { name: 'Role' })

  return panel
}

test('reports an unavailable endpoint without changing the displayed role', async () => {
  const user = setupUser()
  mockUsers()
  server.use(http.patch(`${API_BASE_URL}/api/v1/users/:id/role`, () => HttpResponse.error()))

  const panel = await openPanel()
  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  // A failure, reported as one — the panel stays open on the selection so it can be retried.
  expect(await screen.findByText(/unable to update user/i)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument()

  await user.click(within(panel).getByRole('button', { name: 'Back to details' }))
  const record = await screen.findByRole('dialog')
  await waitFor(() => expect(within(record).getByText('Operations lead')).toBeInTheDocument())
}, 15000)

test('applies the change exactly once when a retry follows a failure', async () => {
  const user = setupUser()
  let attempts = 0
  const applied: UserRole[] = []
  mockUsers()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/users/:id/role`, async ({ request }) => {
      attempts += 1
      if (attempts === 1) {
        return HttpResponse.error()
      }

      const { role } = (await request.json()) as { role: UserRole }
      applied.push(role)

      return HttpResponse.json({ data: { ...target, role } })
    }),
  )

  const panel = await openPanel()
  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))
  await screen.findByText(/unable to update user/i)

  // Retried from where it failed: the selection survived, so no re-picking is needed.
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(applied).toEqual(['OBSERVER']))
  expect(attempts).toBe(2)
}, 15000)
