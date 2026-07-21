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
} from './helpers'

test('cancels logout without ending the session', async () => {
  let logoutRequestCount = 0

  server.use(
    http.post(`${API_BASE_URL}/auth/logout`, () => {
      logoutRequestCount += 1
      return new HttpResponse(null, { status: 204 })
    }),
  )
  mockAuthenticatedSession()

  const { router } = renderApp('/')
  await screen.findByText(ACTIVE_USER.email)

  const dialog = await openLogoutConfirmation()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(logoutRequestCount).toBe(0)
})
