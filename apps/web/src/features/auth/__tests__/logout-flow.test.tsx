import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'
const ACTIVE_USER = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'active.user@portflow.test',
}

async function openLogoutConfirmation() {
  const menu = await screen.findByRole('menu')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Log out' }))
  return screen.findByRole('alertdialog')
}

test('covers the logout confirmation flow', async () => {
  let signedIn = true
  let logoutAttempt = 0
  let releaseLogout: (() => void) | undefined

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
      logoutAttempt += 1

      if (logoutAttempt === 1) {
        return new Promise((resolve) => {
          releaseLogout = () =>
            resolve(
              HttpResponse.json(
                {
                  error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Logout service unavailable' },
                },
                { status: 500 },
              ),
            )
        })
      }

      signedIn = false
      return new HttpResponse(null, { status: 204 })
    }),
  )

  const { router } = renderApp('/')
  await screen.findByText(ACTIVE_USER.email)
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Open user menu for Claire Martin' }))

  const firstDialog = await openLogoutConfirmation()
  fireEvent.click(within(firstDialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')

  const retryDialog = await openLogoutConfirmation()
  fireEvent.click(within(retryDialog).getByRole('button', { name: 'Log out' }))
  expect(await screen.findByRole('button', { name: 'Logging out…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

  releaseLogout?.()
  expect(await screen.findByText('Unable to log out')).toBeInTheDocument()
  expect(screen.getByText('Logout service unavailable')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})
