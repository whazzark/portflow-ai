import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/msw/server'

export const API_BASE_URL = 'http://localhost:3333'

export const CONFINED_USER = {
  id: 1,
  firstName: 'Emma',
  lastName: 'Leroy',
  email: 'confined.user@portflow.test',
  role: 'OBSERVER',
  accessStatus: 'ACTIVE',
  passwordRenewalRequired: true,
}

export const RENEWED_USER = { ...CONFINED_USER, passwordRenewalRequired: false }

export const VALID_PASSWORD = 'correct-horse-battery-staple'

export const UNAUTHENTICATED_BODY = {
  error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
}

/**
 * `auth.me` answers from a mutable session state, the way the API does: the renewal clears the
 * requirement for every later read, which is what the redirect out of the renewal step depends on.
 */
export function mockSession(initial: 'confined' | 'renewed' | 'signed-out') {
  const state = { value: initial }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => {
      if (state.value === 'signed-out') {
        return HttpResponse.json(UNAUTHENTICATED_BODY, { status: 401 })
      }

      return HttpResponse.json({
        data: state.value === 'confined' ? CONFINED_USER : RENEWED_USER,
      })
    }),
  )

  return state
}

export function findRenewalHeading() {
  return screen.findByRole('heading', { name: 'Choose a new password' })
}

export async function submitRenewal(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation = password,
) {
  await user.clear(screen.getByLabelText(/^New password/))
  await user.type(screen.getByLabelText(/^New password/), password)
  await user.clear(screen.getByLabelText(/^Confirm new password/))
  await user.type(screen.getByLabelText(/^Confirm new password/), confirmation)
  await user.click(screen.getByRole('button', { name: 'Save' }))
}
