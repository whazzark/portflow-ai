import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL, openLogoutConfirmation } from './helpers'

test('clears the session and redirects to login after successful logout', async () => {
  let signedIn = true

  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      signedIn
        ? HttpResponse.json({ data: ACTIVE_USER })
        : HttpResponse.json(
            {
              error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
            },
            { status: 401 },
          ),
    ),
    http.post(`${API_BASE_URL}/auth/logout`, () => {
      signedIn = false
      return new HttpResponse(null, { status: 204 })
    }),
  )

  const { router } = renderApp('/')
  await screen.findByText(ACTIVE_USER.email)
  const dialog = await openLogoutConfirmation()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log out' }))

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})
