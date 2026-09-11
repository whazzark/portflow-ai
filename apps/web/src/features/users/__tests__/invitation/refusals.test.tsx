import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

function mockConflict(accessStatus: string) {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_USER_EMAIL_CONFLICT',
            message: 'Email is already in use',
            meta: { accessStatus },
          },
        },
        { status: 409 },
      ),
    ),
  )
}

async function submitInvitation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Invite user' }))

  const panel = await screen.findByRole('dialog')
  await user.type(within(panel).getByLabelText(/First name/), 'Gaspard')
  await user.type(within(panel).getByLabelText(/Last name/), 'Hulot')
  await user.type(within(panel).getByLabelText(/Email/), 'chloe.durand@portflow.test')
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))

  return panel
}

test('points a conflicting email at the action that applies to it', async () => {
  const user = userEvent.setup()
  mockUsers()
  mockConflict('CANCELLED')

  renderUsers()
  const panel = await submitInvitation(user)

  expect(await within(panel).findByText(/Restore it instead/i)).toBeInTheDocument()
})

test('points a pending holder at the activation link renewal', async () => {
  const user = userEvent.setup()
  mockUsers()
  mockConflict('PENDING')

  renderUsers()
  const panel = await submitInvitation(user)

  expect(await within(panel).findByText(/Renew their activation link/i)).toBeInTheDocument()
})

test('keeps everything that was typed when the invitation is refused', async () => {
  const user = userEvent.setup()
  mockUsers()
  mockConflict('ACTIVE')

  renderUsers()
  const panel = await submitInvitation(user)

  await within(panel).findByText(/already holds active access/i)
  expect(within(panel).getByLabelText(/First name/)).toHaveValue('Gaspard')
  expect(within(panel).getByLabelText(/Last name/)).toHaveValue('Hulot')
  expect(within(panel).getByLabelText(/Email/)).toHaveValue('chloe.durand@portflow.test')
})

test('shows no activation link when the invitation is refused', async () => {
  const user = userEvent.setup()
  mockUsers()
  mockConflict('PENDING')

  renderUsers()
  const panel = await submitInvitation(user)

  await within(panel).findByText(/Renew their activation link/i)
  expect(screen.queryByText(/activate\//)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copy activation link' })).not.toBeInTheDocument()
})
