import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { API_BASE_URL } from './session-test-helpers'

test('shows a distinct error when session restoration fails for a reason other than being unauthenticated', async () => {
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Internal server error' } },
        { status: 500 },
      ),
    ),
  )
  renderApp('/')
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  expect(
    screen.queryByRole('heading', { name: 'Keep every handoff on track' }),
  ).not.toBeInTheDocument()
})
