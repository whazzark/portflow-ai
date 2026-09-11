import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { UserDto } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, DEACTIVATED_AT, RESPONSIBLE_ADMIN, USERS } from '../support/fixtures'
import { mockRoleChangeRefused, mockUsers, renderUsers, selectRole } from '../support/test-helpers'

const target = USERS.find((entry) => entry.id === 'active-2') as UserDto

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 })

/** The collection once another administrator has deactivated the target. */
const deactivatedElsewhere = (users: UserDto[]): UserDto[] =>
  users.map((user) =>
    user.id === target.id
      ? {
          ...user,
          accessStatus: 'DEACTIVATED',
          deactivatedAt: DEACTIVATED_AT,
          deactivatedBy: RESPONSIBLE_ADMIN,
        }
      : user,
  )

// The interface stays honest about what the API would accept; the API remains authoritative. The
// identity of a deactivated user stays correctable, so the panel opens — without a role to pick.
test('offers no role change on a deactivated user, and says why', async () => {
  mockUsers()

  renderUsers('/users?status=deactivated&userId=deactivated-1&mode=edit')
  const panel = await screen.findByRole('dialog')
  await within(panel).findByRole('heading', { name: 'Edit user' })

  expect(within(panel).queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument()
  expect(within(panel).getByText(/reactivate the user first/i)).toBeInTheDocument()
})

test('surfaces a refusal and leaves the displayed role unchanged', async () => {
  const user = setupUser()
  mockUsers()
  mockRoleChangeRefused()

  renderUsers('/users?userId=active-2&mode=edit')
  const panel = await screen.findByRole('dialog')
  await screen.findByRole('combobox', { name: 'Role' })

  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  expect(
    (await screen.findAllByText(/Deactivated users cannot have their role changed/i)).length,
  ).toBeGreaterThan(0)

  // The panel stays open on the refused selection, so the administrator can correct it.
  expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument()

  await user.click(within(panel).getByRole('button', { name: 'Back to details' }))
  const record = await screen.findByRole('dialog')
  await waitFor(() => expect(within(record).getByText('Operations lead')).toBeInTheDocument())
  expect(target.role).toBe('OPERATIONS_LEAD')
}, 15000)

// Another administrator deactivates the user while the panel is open. The identity lands first,
// and its refresh already reports the user as deactivated: they leave the active users, and the
// panel closes with them rather than staying open without a role picker while still holding the
// role that was picked. The role then refused must still be reported.
test('closes the panel on a user deactivated between the identity and the role', async () => {
  const user = setupUser()
  let collection = USERS
  let roleAttempts = 0
  mockUsers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: collection })),
    http.patch(`${API_BASE_URL}/api/v1/users/:id`, async ({ request }) => {
      const body = (await request.json()) as Partial<UserDto>
      collection = deactivatedElsewhere(
        USERS.map((entry) => (entry.id === target.id ? { ...entry, ...body } : entry)),
      )

      return HttpResponse.json({ data: collection.find((entry) => entry.id === target.id) })
    }),
    http.patch(`${API_BASE_URL}/api/v1/users/:id/role`, () => {
      roleAttempts += 1

      return HttpResponse.json(
        {
          error: {
            code: 'E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE',
            message: 'Deactivated users cannot have their role changed; reactivate the user first',
          },
        },
        { status: 409 },
      )
    }),
  )

  renderUsers('/users?userId=active-2&mode=edit')
  const panel = await screen.findByRole('dialog')
  await screen.findByRole('combobox', { name: 'Role' })

  const firstName = within(panel).getByRole('textbox', { name: 'First name' })
  await user.clear(firstName)
  await user.type(firstName, 'Bruna')
  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  expect(
    (await screen.findAllByText(/Deactivated users cannot have their role changed/i)).length,
  ).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(roleAttempts).toBe(1)
  const table = await screen.findByRole('table', { name: 'Active users' })
  expect(within(table).queryByText('Bruna Costa')).not.toBeInTheDocument()
}, 15000)

