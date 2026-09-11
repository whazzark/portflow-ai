import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { UserDto, UserRole } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from '../support/fixtures'
import {
  mockIdentityCorrection,
  mockRoleChange,
  mockUsers,
  renderUsers,
  selectRole,
} from '../support/test-helpers'

const target = USERS.find((entry) => entry.id === 'active-2') as UserDto

// The record opens in a modal sheet, which puts `pointer-events: none` on everything behind it.
// The check is what is disabled here, never the behaviour under test.
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 })

const openEditorFor = async (user: UserEvent, name: string) => {
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  // The panel swaps in on a navigation, so wait for its control: the dialog is the same node
  // before and after.
  await screen.findByRole('combobox', { name: 'Role' })

  return screen.getByRole('dialog')
}

type UserEvent = ReturnType<typeof userEvent.setup>

test('changes an active user role from the edit panel', async () => {
  const user = setupUser()
  let changedTo: UserRole | null = null
  mockUsers()
  mockRoleChange(target, (role) => {
    changedTo = role
  })

  renderUsers()
  const panel = await openEditorFor(user, 'Bruno Costa')

  // The role the user holds today is the starting value, so the current one is always visible.
  expect(within(panel).getByRole('combobox', { name: 'Role' })).toHaveTextContent('Operations lead')

  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OPERATIONS_ADMIN')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(changedTo).toBe('OPERATIONS_ADMIN'))
}, 15000)

test('shows the new role in the record and the table without a reload', async () => {
  const user = setupUser()
  let current: UserDto[] = USERS

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: ORGANIZATION_ADMIN }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: current })),
    http.patch(`${API_BASE_URL}/api/v1/users/:id/role`, async ({ request }) => {
      const { role } = (await request.json()) as { role: UserRole }
      current = current.map((entry) => (entry.id === target.id ? { ...entry, role } : entry))

      return HttpResponse.json({ data: { ...target, role } })
    }),
  )

  renderUsers()
  const panel = await openEditorFor(user, 'Bruno Costa')
  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  // Back on the read-only record, showing the role that was just assigned.
  const record = await screen.findByRole('dialog')
  await waitFor(() => expect(within(record).getByText('Observer')).toBeInTheDocument())

  // The collection behind the modal sheet followed the change too.
  await user.click(within(record).getByRole('button', { name: 'Close' }))
  const table = await screen.findByRole('table', { name: 'Active users' })
  await waitFor(() =>
    expect(within(table).getByRole('row', { name: /Bruno Costa/ })).toHaveTextContent('Observer'),
  )
}, 15000)

test('sends the role alone when only the role changed', async () => {
  const user = setupUser()
  const { corrections } = mockIdentityCorrection()
  const changes: UserRole[] = []
  mockRoleChange(target, (role) => changes.push(role))

  renderUsers()
  const panel = await openEditorFor(user, 'Bruno Costa')
  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(changes).toEqual(['OBSERVER']))
  expect(corrections).toHaveLength(0)
}, 15000)

test('sends the identity and the role when both changed', async () => {
  const user = setupUser()
  const { corrections } = mockIdentityCorrection()
  const changes: UserRole[] = []
  mockRoleChange(target, (role) => changes.push(role))

  renderUsers()
  const panel = await openEditorFor(user, 'Bruno Costa')
  const firstName = within(panel).getByRole('textbox', { name: 'First name' })
  await user.clear(firstName)
  await user.type(firstName, 'Bruna')
  await selectRole(user, panel, 'OPERATIONS_LEAD', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(changes).toEqual(['OBSERVER']))
  expect(corrections).toEqual([
    { id: 'active-2', body: expect.objectContaining({ firstName: 'Bruna' }) },
  ])
}, 15000)

test('sends no role change when the role is left as it is', async () => {
  const user = setupUser()
  const { corrections } = mockIdentityCorrection()
  const changes: UserRole[] = []
  mockRoleChange(target, (role) => changes.push(role))

  renderUsers()
  const panel = await openEditorFor(user, 'Bruno Costa')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  // Reported as a success: the panel gives way to the record rather than showing a refusal.
  await waitFor(() =>
    expect(screen.queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument(),
  )
  expect(corrections).toHaveLength(1)
  expect(changes).toHaveLength(0)
}, 15000)

test('offers the role change on a pending and on a cancelled user', async () => {
  mockUsers()

  const pending = renderUsers('/users?status=pending&userId=pending-1&mode=edit')
  expect(await screen.findByRole('combobox', { name: 'Role' })).toBeInTheDocument()
  pending.unmount()

  renderUsers('/users?status=cancelled&userId=cancelled-1&mode=edit')
  expect(await screen.findByRole('combobox', { name: 'Role' })).toBeInTheDocument()
})
