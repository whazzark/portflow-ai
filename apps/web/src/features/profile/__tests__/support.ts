import { fireEvent, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'

import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

export const API_BASE_URL = 'http://localhost:3333'
export const OWN_PROFILE_URL = `${API_BASE_URL}/api/v1/me/profile`
export const OWN_PASSWORD_URL = `${API_BASE_URL}/api/v1/me/password`
export const ME_URL = `${API_BASE_URL}/api/v1/auth/me`

export type SessionFixture = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'ORGANIZATION_ADMIN' | 'OPERATIONS_ADMIN' | 'OPERATIONS_LEAD' | 'OBSERVER'
  accessStatus: 'ACTIVE'
  passwordRenewalRequired: boolean
}

export const SESSION_USER: SessionFixture = {
  id: 'self-1',
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'OBSERVER',
  accessStatus: 'ACTIVE',
  passwordRenewalRequired: false,
}

export type IdentitySubmission = {
  firstName: string
  lastName: string
  email: string
  currentPassword?: string
}

/**
 * A session the server keeps in step with the updates it accepts, the way the API does: `auth/me`
 * answers the stored identity, and an accepted update replaces it.
 */
export function mockSession(overrides: Partial<SessionFixture> = {}) {
  const session = { user: { ...SESSION_USER, ...overrides } }
  const submissions: IdentitySubmission[] = []
  let meReads = 0

  server.use(
    http.get(ME_URL, () => {
      meReads += 1

      return HttpResponse.json({ data: session.user })
    }),
    http.patch(OWN_PROFILE_URL, async ({ request }) => {
      const body = (await request.json()) as IdentitySubmission
      submissions.push(body)
      session.user = {
        ...session.user,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
      }

      return HttpResponse.json({ data: session.user })
    }),
  )

  return {
    session,
    submissions,
    meReads: () => meReads,
  }
}

export type PasswordSubmission = {
  currentPassword: string
  password: string
  passwordConfirmation: string
}

/** Accepts every password change, recording what was sent. The session is unchanged by one. */
export function mockPasswordChange() {
  const submissions: PasswordSubmission[] = []

  server.use(
    http.patch(OWN_PASSWORD_URL, async ({ request }) => {
      submissions.push((await request.json()) as PasswordSubmission)

      return HttpResponse.json({ data: SESSION_USER })
    }),
  )

  return { submissions }
}

/** Answers every password change with the given refusal, recording what was sent. */
export function mockPasswordRefusal(status: number, code: string, message: string) {
  const submissions: PasswordSubmission[] = []

  server.use(
    http.patch(OWN_PASSWORD_URL, async ({ request }) => {
      submissions.push((await request.json()) as PasswordSubmission)

      return HttpResponse.json({ error: { code, message } }, { status })
    }),
  )

  return { submissions }
}

/** Answers every submission with the given refusal, recording what was sent. */
export function mockRefusal(status: number, code: string, message: string, details?: unknown) {
  const submissions: IdentitySubmission[] = []

  server.use(
    http.patch(OWN_PROFILE_URL, async ({ request }) => {
      submissions.push((await request.json()) as IdentitySubmission)

      return HttpResponse.json({ error: { code, message, details } }, { status })
    }),
  )

  return { submissions }
}

export function renderProfile() {
  return renderApp('/profile')
}

export async function findForm() {
  await screen.findByRole('heading', { name: 'Identity' }, { timeout: 5000 })

  return screen.getByRole('form', { name: 'Identity' })
}

export const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } })

export const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
