import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { API_BASE_URL, findRenewalHeading, mockSession } from './helpers'

test('lets a confined user leave the renewal step through the delivered log out flow', async () => {
  const session = mockSession('confined')
  server.use(
    http.post(`${API_BASE_URL}/api/v1/auth/logout`, () => {
      session.value = 'signed-out'
      return new HttpResponse(null, { status: 204 })
    }),
  )

  const { router } = renderApp('/')
  await findRenewalHeading()

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log out' }))

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})
