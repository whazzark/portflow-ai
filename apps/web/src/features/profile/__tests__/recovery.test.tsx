import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'

import {
  fill,
  findForm,
  ME_URL,
  mockSession,
  OWN_PROFILE_URL,
  renderProfile,
  SESSION_USER,
  save,
} from './support'

/**
 * A session the server can end or confine between two requests, the way an expired session or an
 * administrator's password reset does: `auth/me` follows whatever the refusal just announced.
 */
function mockSessionThatChanges(refusal: { status: number; code: string; message: string }) {
  const state = { refused: false }

  server.use(
    http.get(ME_URL, () => {
      if (state.refused && refusal.status === 401) {
        return HttpResponse.json(
          { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' } },
          { status: 401 },
        )
      }

      return HttpResponse.json({
        data: { ...SESSION_USER, passwordRenewalRequired: state.refused },
      })
    }),
    http.patch(OWN_PROFILE_URL, () => {
      state.refused = true

      return HttpResponse.json(
        { error: { code: refusal.code, message: refusal.message } },
        { status: refusal.status },
      )
    }),
  )
}

test.each([
  ['a network failure', () => HttpResponse.error()],
  [
    'a server failure',
    () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL', message: 'Something went wrong. Please try again.' } },
        { status: 500 },
      ),
  ],
])(
  'reports %s, keeps the input, and applies on retry',
  async (_, failure) => {
    const { submissions } = mockSession()
    server.use(http.patch(OWN_PROFILE_URL, failure, { once: true }))

    renderProfile()
    const form = await findForm()
    fill('Last name', 'Renard')
    fill('Email', 'camille.renard@portflow.test')
    fill('Current password', 'Password!234')
    save()

    expect(await screen.findByText('Unable to update identity “Claire Martin”')).toBeInTheDocument()
    expect(within(form).getByRole('alert')).toBeInTheDocument()
    expect(within(form).getByLabelText(/Last name/)).toHaveValue('Renard')
    expect(within(form).getByLabelText(/Email/)).toHaveValue('camille.renard@portflow.test')
    expect(within(form).getByLabelText(/Current password/)).toHaveValue('')
    // Not presented as applied: the session still carries the former identity.
    expect(
      screen.getByRole('button', { name: 'Open user menu for Claire Martin' }),
    ).toBeInTheDocument()
    expect(submissions).toHaveLength(0)

    fill('Current password', 'Password!234')
    save()

    expect(
      await screen.findByRole('button', { name: 'Open user menu for Claire Renard' }),
    ).toBeInTheDocument()
    expect(submissions).toHaveLength(1)
  },
  15000,
)

test('shows the current address when an administrator moved it under the form', async () => {
  const { session, meReads } = mockSession()
  server.use(
    http.patch(
      OWN_PROFILE_URL,
      () => {
        // What the API sees: the address the form still carries is no longer the stored one.
        session.user = { ...session.user, email: 'moved.by.an.administrator@portflow.test' }

        return HttpResponse.json(
          {
            error: {
              code: 'E_CURRENT_PASSWORD_REQUIRED',
              message: 'Enter your current password to change your email address.',
            },
          },
          { status: 422 },
        )
      },
      { once: true },
    ),
  )

  renderProfile()
  const form = await findForm()
  const readsBefore = meReads()
  fill('First name', 'Camille')
  save()

  await waitFor(() => expect(meReads()).toBeGreaterThan(readsBefore))
  // The address as it now stands, not the one the form was opened on: the form must never ask for a
  // password to put back an address the user never saw replaced.
  await waitFor(() =>
    expect(within(form).getByLabelText(/Email/)).toHaveValue(
      'moved.by.an.administrator@portflow.test',
    ),
  )
  expect(
    within(form).getByText(
      /Your email address was changed by an administrator.*moved\.by\.an\.administrator@portflow\.test/,
    ),
  ).toBeInTheDocument()
  expect(within(form).queryByLabelText(/Current password/)).not.toBeInTheDocument()
  // What the user typed elsewhere survives.
  expect(within(form).getByLabelText(/First name/)).toHaveValue('Camille')
}, 15000)

test('sends a user who owes a password renewal to the renewal first', async () => {
  server.use(
    http.get(ME_URL, () =>
      HttpResponse.json({ data: { ...SESSION_USER, passwordRenewalRequired: true } }),
    ),
  )

  const { router } = renderProfile()

  await waitFor(() => expect(router.state.location.pathname).toBe('/password-renewal'))
})

test('sends a signed-out visitor to sign-in', async () => {
  const { router } = renderProfile()

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
})

test('hands an ended session over to sign-in, without a toast', async () => {
  mockSessionThatChanges({
    status: 401,
    code: 'E_UNAUTHORIZED_ACCESS',
    message: 'Unauthorized access',
  })

  const { router } = renderProfile()
  await findForm()
  fill('Last name', 'Renard')
  save()

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(screen.queryByText(/Unable to update/)).not.toBeInTheDocument()
})

test('hands a session that now owes a renewal over to the renewal, without a toast', async () => {
  mockSessionThatChanges({
    status: 403,
    code: 'E_PASSWORD_RENEWAL_REQUIRED',
    message: 'Choose a new password before using the application',
  })

  const { router } = renderProfile()
  await findForm()
  fill('Last name', 'Renard')
  save()

  await waitFor(() => expect(router.state.location.pathname).toBe('/password-renewal'))
  expect(screen.queryByText(/Unable to update/)).not.toBeInTheDocument()
})
