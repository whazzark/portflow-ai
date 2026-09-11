import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

export const API_BASE_URL = 'http://localhost:3333'

export const ACTIVATION_TOKEN = 'h7Qk2vX9-a-very-confidential-secret'

export const PREVIEW_PATH = `${API_BASE_URL}/api/v1/auth/invitation-acceptance/preview`
export const ACCEPTANCE_PATH = `${API_BASE_URL}/api/v1/auth/invitation-acceptance`

export const PREVIEW = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
}

export const ACTIVATED_USER = {
  id: '00000000-0000-4000-8000-000000000042',
  ...PREVIEW,
  role: 'OPERATIONS_LEAD',
  accessStatus: 'ACTIVE',
  passwordRenewalRequired: false,
}

export const SIGNED_IN_ADMIN = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Yann',
  lastName: 'Le Goff',
  email: 'yann.legoff@portflow.test',
  role: 'ORGANIZATION_ADMIN',
  accessStatus: 'ACTIVE',
  passwordRenewalRequired: false,
}

export const VALID_PASSWORD = 'correct-horse-battery-staple'

export const UNAUTHENTICATED_BODY = {
  error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
}

export const UNUSABLE_LINK_BODY = {
  error: { code: 'E_ACTIVATION_LINK_UNUSABLE', message: 'This activation link cannot be used' },
}

type SessionUser = typeof ACTIVATED_USER | typeof SIGNED_IN_ADMIN

/**
 * `auth.me` answers from a mutable session, the way the API does: the acceptance opens a session,
 * a logout closes one, and every later read sees it.
 */
export function mockSession(initial: SessionUser | null = null) {
  const state: { user: SessionUser | null } = { user: initial }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      state.user
        ? HttpResponse.json({ data: state.user })
        : HttpResponse.json(UNAUTHENTICATED_BODY, { status: 401 }),
    ),
    http.post(`${API_BASE_URL}/api/v1/auth/logout`, () => {
      state.user = null

      return new HttpResponse(null, { status: 204 })
    }),
  )

  return state
}

export function mockPreview(respond: () => Response = () => HttpResponse.json({ data: PREVIEW })) {
  server.use(http.post(PREVIEW_PATH, respond))
}

export function mockAcceptance(respond: (request: Request) => Response | Promise<Response>) {
  server.use(http.post(ACCEPTANCE_PATH, ({ request }) => respond(request)))
}

export function renderActivation() {
  return renderApp(`/activate/${ACTIVATION_TOKEN}`)
}

export function findActivationHeading() {
  return screen.findByRole('heading', { name: 'Activate your access' })
}

export async function submitActivation(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation = password,
) {
  await user.clear(screen.getByLabelText(/^Password/))
  await user.type(screen.getByLabelText(/^Password/), password)
  await user.clear(screen.getByLabelText(/^Confirm password/))
  await user.type(screen.getByLabelText(/^Confirm password/), confirmation)
  await user.click(screen.getByRole('button', { name: 'Activate' }))
}
