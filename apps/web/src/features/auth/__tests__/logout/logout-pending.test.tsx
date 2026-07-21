import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  ACTIVE_USER,
  API_BASE_URL,
  mockAuthenticatedSession,
  openLogoutConfirmation,
} from './logout-test-helpers'

test('disables confirmation controls while logout is pending', async () => {
  let releaseLogout: (() => void) | undefined

  server.use(
    http.post(
      `${API_BASE_URL}/auth/logout`,
      () =>
        new Promise<Response>((resolve) => {
          releaseLogout = () => resolve(new HttpResponse(null, { status: 204 }))
        }),
    ),
  )
  mockAuthenticatedSession()

  renderApp('/')
  await screen.findByText(ACTIVE_USER.email)
  const dialog = await openLogoutConfirmation()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log out' }))

  expect(await screen.findByRole('button', { name: 'Logging out…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(releaseLogout).toBeTypeOf('function')

  releaseLogout?.()
  expect(await screen.findByRole('button', { name: 'Log out' })).not.toBeDisabled()
})
