import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

async function openInvitation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Invite user' }))

  return screen.findByRole('dialog')
}

test('refuses an incomplete invitation without calling the API', async () => {
  const user = userEvent.setup()
  mockUsers()
  let invitations = 0
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, () => {
      invitations += 1

      return HttpResponse.json({}, { status: 201 })
    }),
  )

  renderUsers()
  const panel = await openInvitation(user)
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))

  expect(await within(panel).findByText('First name is required.')).toBeInTheDocument()
  expect(within(panel).getByText('Last name is required.')).toBeInTheDocument()
  expect(within(panel).getByText('Email is required.')).toBeInTheDocument()
  expect(invitations).toBe(0)
})

test('refuses a malformed email', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const panel = await openInvitation(user)
  await user.type(within(panel).getByLabelText(/First name/), 'Gaspard')
  await user.type(within(panel).getByLabelText(/Last name/), 'Hulot')
  await user.type(within(panel).getByLabelText(/Email/), 'gaspard.hulot')
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))

  expect(await within(panel).findByText('Enter a valid email.')).toBeInTheDocument()
})

test('shows the API field-level refusals on their own fields', async () => {
  const user = userEvent.setup()
  mockUsers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            message: 'Validation failure',
            details: [{ field: 'email', message: 'The email field must be a valid email address' }],
          },
        },
        { status: 422 },
      ),
    ),
  )

  renderUsers()
  const panel = await openInvitation(user)
  await user.type(within(panel).getByLabelText(/First name/), 'Gaspard')
  await user.type(within(panel).getByLabelText(/Last name/), 'Hulot')
  await user.type(within(panel).getByLabelText(/Email/), 'gaspard.hulot@portflow.test')
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))

  expect(
    await within(panel).findByText('The email field must be a valid email address'),
  ).toBeInTheDocument()
})

test('offers every responsibility level, observer included', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const panel = await openInvitation(user)
  await user.click(within(panel).getByLabelText(/Role/))

  for (const role of ['Organization admin', 'Operations admin', 'Operations lead', 'Observer']) {
    expect(await screen.findByRole('option', { name: role })).toBeInTheDocument()
  }
})
