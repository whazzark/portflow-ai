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

test('keeps confirmation open and shows the API error when logout fails', async () => {
  server.use(
    http.post(`${API_BASE_URL}/auth/logout`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Logout service unavailable' } },
        { status: 500 },
      ),
    ),
  )
  mockAuthenticatedSession()

  renderApp('/')
  await screen.findByText(ACTIVE_USER.email)
  const dialog = await openLogoutConfirmation()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log out' }))

  expect(await screen.findByText('Unable to log out')).toBeInTheDocument()
  expect(screen.getByText('Logout service unavailable')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})
