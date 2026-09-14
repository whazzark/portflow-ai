import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { UserDto } from '@/features/users/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  API_BASE_URL,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
import { renderUsers, selectRole } from '../support/test-helpers'

/**
 * GH-29 User Story 3. The final organization admin refusal only ever reaches an administrator who
 * stopped being an active organization admin in the same collision — had they still been one, they
 * would have been the admin who remains. So every test below flips the viewer's own session at the
 * moment the refusal is returned, as the other side of the collision did, and checks that the
 * workbench follows them rather than keeping a panel they may no longer use.
 */

const TARGET_ID = 'active-2'
const REFUSAL = {
  code: 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN',
  message: 'The organization must keep at least one active organization admin',
}

// The record opens in a modal sheet, which puts `pointer-events: none` on everything behind it.
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 })

type Collision = 'demoted' | 'deactivated'

/**
 * The workbench of an organization admin editing Bruno Costa, himself an organization admin. The
 * role change is refused, and in the same instant the viewer is demoted or deactivated: `auth.me`
 * and the collection answer accordingly from then on. An identity correction, when one is sent,
 * lands before the refusal.
 */
function mockCollision(collision: Collision) {
  let refused = false
  let corrected: Partial<UserDto> = {}
  const identityRequests: unknown[] = []

  const asAdmin = (user: UserDto) =>
    user.id === TARGET_ID ? { ...user, role: 'ORGANIZATION_ADMIN', ...corrected } : user
  const organizationAdminView = () => USERS.map((user) => asAdmin(user as UserDto))
  const operationsAdminView = () =>
    ACTIVE_USERS_WITHOUT_LIFECYCLE.map((user) => asAdmin(user as UserDto))
  const unauthorized = () =>
    HttpResponse.json(
      { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Unauthorized access' } },
      { status: 401 },
    )

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => {
      if (!refused) {
        return HttpResponse.json({ data: ORGANIZATION_ADMIN })
      }

      return collision === 'deactivated'
        ? unauthorized()
        : HttpResponse.json({ data: { ...ORGANIZATION_ADMIN, role: 'OPERATIONS_ADMIN' } })
    }),
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      if (!refused) {
        return HttpResponse.json({ data: organizationAdminView() })
      }

      return collision === 'deactivated'
        ? unauthorized()
        : HttpResponse.json({ data: operationsAdminView() })
    }),
    http.patch(`${API_BASE_URL}/api/v1/users/:id`, async ({ request }) => {
      const body = (await request.json()) as Partial<UserDto>
      identityRequests.push(body)
      corrected = { ...corrected, ...body }

      return HttpResponse.json({
        data: organizationAdminView().find((user) => user.id === TARGET_ID),
      })
    }),
    http.patch(`${API_BASE_URL}/api/v1/users/:id/role`, () => {
      refused = true

      return HttpResponse.json({ error: REFUSAL }, { status: 409 })
    }),
  )

  return { identityRequests }
}

const openEditor = async () => {
  const rendered = renderUsers(`/users?userId=${TARGET_ID}&mode=edit`)
  await screen.findByRole('combobox', { name: 'Role' })

  return { ...rendered, panel: screen.getByRole('dialog') }
}

test('follows a viewer demoted in the same collision', async () => {
  const user = setupUser()
  mockCollision('demoted')

  const { panel } = await openEditor()
  await selectRole(user, panel, 'ORGANIZATION_ADMIN', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  // The reason is reported, and it is still there once the panel has gone.
  expect((await screen.findAllByText(REFUSAL.message)).length).toBeGreaterThan(0)
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Edit user' })).not.toBeInTheDocument(),
  )
  expect(screen.getAllByText(REFUSAL.message).length).toBeGreaterThan(0)

  // The record, as an operations admin sees it: the target is still an organization admin, and
  // nothing about them may be changed any more.
  const record = await screen.findByRole('dialog')
  expect(within(record).getByRole('heading', { name: /Bruno Costa/ })).toBeInTheDocument()
  expect(within(record).getByText('Organization admin')).toBeInTheDocument()
  expect(within(record).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  // An operations admin consults the active users alone, so the status views go too.
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
}, 15000)

test('sends a viewer deactivated in the same collision to sign-in', async () => {
  const user = setupUser()
  mockCollision('deactivated')

  const { panel, router } = await openEditor()
  await selectRole(user, panel, 'ORGANIZATION_ADMIN', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 })
}, 15000)

// FR-013: what landed before the refusal stays landed, and is shown as such.
test('keeps an identity correction that landed before the refusal', async () => {
  const user = setupUser()
  const { identityRequests } = mockCollision('demoted')

  const { panel } = await openEditor()
  const firstName = within(panel).getByRole('textbox', { name: 'First name' })
  await user.clear(firstName)
  await user.type(firstName, 'Bruna')
  await selectRole(user, panel, 'ORGANIZATION_ADMIN', 'OBSERVER')
  await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

  expect((await screen.findAllByText(REFUSAL.message)).length).toBeGreaterThan(0)
  const record = await screen.findByRole('dialog')
  await waitFor(() =>
    expect(within(record).getByRole('heading', { name: /Bruna Costa/ })).toBeInTheDocument(),
  )
  expect(within(record).getByText('Organization admin')).toBeInTheDocument()
  expect(identityRequests).toHaveLength(1)
}, 15000)
