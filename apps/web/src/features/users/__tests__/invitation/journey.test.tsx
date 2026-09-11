import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

const INVITED_USER = {
  id: 'pending-2',
  firstName: 'Gaspard',
  lastName: 'Hulot',
  email: 'gaspard.hulot@portflow.test',
  role: 'OPERATIONS_LEAD',
  accessStatus: 'PENDING',
  invitedAt: '2026-09-10T12:00:00.000Z',
  invitedBy: { id: ORGANIZATION_ADMIN.id, firstName: 'Claire', lastName: 'Martin' },
  activatedAt: null,
  activatedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  deactivatedAt: null,
  deactivatedBy: null,
  reactivatedAt: null,
  reactivatedBy: null,
}

const ACTIVATION_LINK = {
  url: 'http://localhost:3000/activate/a-very-confidential-secret',
  expiresAt: '2026-09-17T12:00:00.000Z',
}

function mockInvitation() {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json(
        { data: { user: INVITED_USER, activationLink: ACTIVATION_LINK } },
        { status: 201 },
      ),
    ),
  )
}

/** The collection answers with the new pending user once the invitation has been recorded. */
function mockCollectionAfterInvitation() {
  let invited = false

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: ORGANIZATION_ADMIN }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json({ data: invited ? [...USERS, INVITED_USER] : USERS }),
    ),
    http.post(`${API_BASE_URL}/api/v1/users`, () => {
      invited = true

      return HttpResponse.json(
        { data: { user: INVITED_USER, activationLink: ACTIVATION_LINK } },
        { status: 201 },
      )
    }),
  )
}

async function submitInvitation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Invite user' }))

  const panel = await screen.findByRole('dialog')
  await user.type(within(panel).getByLabelText(/First name/), 'Gaspard')
  await user.type(within(panel).getByLabelText(/Last name/), 'Hulot')
  await user.type(within(panel).getByLabelText(/Email/), 'gaspard.hulot@portflow.test')
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))

  return panel
}

test('opens the invitation panel and holds it in the URL', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await user.click(await screen.findByRole('button', { name: 'Invite user' }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ mode: 'create' })
})

test('shows the activation link once, with its expiry, after a successful invitation', async () => {
  const user = userEvent.setup()
  mockUsers()
  mockInvitation()

  const { router } = renderUsers()
  await submitInvitation(user)

  const outcome = await screen.findByRole('alertdialog')
  expect(await within(outcome).findByText(ACTIVATION_LINK.url)).toBeInTheDocument()
  expect(within(outcome).getByText(/shown once/i)).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    mode: 'create',
    invitedUserId: INVITED_USER.id,
  })
})

test('copies the activation link on request', async () => {
  const user = userEvent.setup()
  // `userEvent.setup()` installs the clipboard stub this spies on.
  const writeText = vi.spyOn(navigator.clipboard, 'writeText')
  mockUsers()
  mockInvitation()

  renderUsers()
  await submitInvitation(user)

  const outcome = await screen.findByRole('alertdialog')
  await user.click(await within(outcome).findByRole('button', { name: 'Copy activation link' }))

  expect(writeText).toHaveBeenCalledWith(ACTIVATION_LINK.url)
})

test('refuses to dismiss the activation link without an explicit acknowledgement', async () => {
  const user = userEvent.setup()
  mockUsers()
  mockInvitation()

  renderUsers()
  await submitInvitation(user)

  const outcome = await screen.findByRole('alertdialog')
  await within(outcome).findByText(ACTIVATION_LINK.url)
  await user.keyboard('{Escape}')

  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(screen.getByText(ACTIVATION_LINK.url)).toBeInTheDocument()
})

test('lands on the pending view with the new user highlighted once acknowledged', async () => {
  const user = userEvent.setup()
  mockCollectionAfterInvitation()

  const { router } = renderUsers()
  await submitInvitation(user)

  const outcome = await screen.findByRole('alertdialog')
  await within(outcome).findByText(ACTIVATION_LINK.url)
  await user.click(within(outcome).getByRole('button', { name: 'Done' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(router.state.location.search).toMatchObject({
    status: 'pending',
    invitedUserId: INVITED_USER.id,
  })
  expect(router.state.location.search).not.toHaveProperty('mode')

  const table = await screen.findByRole('table', { name: 'Pending users' })
  const row = within(table).getByRole('button', { name: 'View user Gaspard Hulot' }).closest('tr')

  expect(row).toHaveAttribute('data-highlighted', 'true')
})

test('does not reopen the activation link after a reload', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers(`/users?mode=create&invitedUserId=${USERS[2].id}`)

  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  expect(screen.queryByText(/activate\//)).not.toBeInTheDocument()
  expect(screen.getByText(/no longer available/i)).toBeInTheDocument()
  // The form is not sitting behind it: one invitation, one surface at a time.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Done' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
})
