import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL } from './helpers'

test('redirects an authenticated user away from the login screen', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
  )
  renderApp('/login')
  expect(await screen.findByText(ACTIVE_USER.email)).toBeInTheDocument()
})
