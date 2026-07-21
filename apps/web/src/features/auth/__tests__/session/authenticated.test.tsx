import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL } from './helpers'

test('restores an authenticated session on load', async () => {
  server.use(http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })))
  renderApp('/')
  expect(await screen.findByText(ACTIVE_USER.email, {}, { timeout: 3_000 })).toBeInTheDocument()
})
