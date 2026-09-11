import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL, USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

const INVITED_USER = {
  ...USERS[2],
  id: 'pending-2',
  firstName: 'Gaspard',
  lastName: 'Hulot',
  email: 'gaspard.hulot@portflow.test',
}

const ACTIVATION_LINK = {
  url: 'http://localhost:3000/activate/a-very-confidential-secret',
  expiresAt: '2026-09-17T12:00:00.000Z',
}

async function fillInvitation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Invite user' }))

  const panel = await screen.findByRole('dialog')
  await user.type(within(panel).getByLabelText(/First name/), 'Gaspard')
  await user.type(within(panel).getByLabelText(/Last name/), 'Hulot')
  await user.type(within(panel).getByLabelText(/Email/), 'gaspard.hulot@portflow.test')

  return panel
}

test('reports a server failure as retryable and keeps what was typed', async () => {
  const user = userEvent.setup()
  mockUsers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_ERROR', message: 'Unavailable' } },
        { status: 500 },
      ),
    ),
  )

  renderUsers()
  const panel = await fillInvitation(user)
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))

  // A failure, not a refusal: no field is blamed, and nothing has to be typed again.
  expect(await screen.findByText(/Unable to create user/i)).toBeInTheDocument()
  expect(within(panel).getByLabelText(/Email/)).toHaveValue('gaspard.hulot@portflow.test')
  expect(screen.queryByText(/activate\//)).not.toBeInTheDocument()
})

test('grants one access when the invitation is submitted twice in a row', async () => {
  const user = userEvent.setup()
  let invitations = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: { ...USERS[0], role: 'ORGANIZATION_ADMIN' } }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: USERS })),
    http.post(`${API_BASE_URL}/api/v1/users`, async () => {
      invitations += 1
      await new Promise((resolve) => setTimeout(resolve, 50))

      return HttpResponse.json(
        { data: { user: INVITED_USER, activationLink: ACTIVATION_LINK } },
        { status: 201 },
      )
    }),
  )

  renderUsers()
  const panel = await fillInvitation(user)
  const submit = within(panel).getByRole('button', { name: 'Invite user' })
  await user.click(submit)
  await user.click(submit)

  await within(await screen.findByRole('alertdialog')).findByText(ACTIVATION_LINK.url)
  expect(invitations).toBe(1)
})

test('still shows the activation link when the panel is dismissed while the invitation is in flight', async () => {
  const user = userEvent.setup()
  mockUsers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))

      return HttpResponse.json(
        { data: { user: INVITED_USER, activationLink: ACTIVATION_LINK } },
        { status: 201 },
      )
    }),
  )

  renderUsers()
  const panel = await fillInvitation(user)
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))
  await user.keyboard('{Escape}')

  // The access is granted whatever the administrator did meanwhile, so its secret is not dropped.
  await within(await screen.findByRole('alertdialog')).findByText(ACTIVATION_LINK.url)
})

test('admits the activation link is gone rather than pretending to show it', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers(`/users?mode=create&invitedUserId=${USERS[2].id}`)

  const outcome = await screen.findByRole('alertdialog')

  expect(within(outcome).getByText(/no longer available/i)).toBeInTheDocument()
  expect(within(outcome).getByText(/Renew the activation link/i)).toBeInTheDocument()
  // Named in the dialog, so the administrator knows whose link cannot be shown again.
  expect(within(outcome).getAllByText(/Chloé Durand/).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Copy activation link' })).not.toBeInTheDocument()

  await user.click(within(outcome).getByRole('button', { name: 'Done' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
})
