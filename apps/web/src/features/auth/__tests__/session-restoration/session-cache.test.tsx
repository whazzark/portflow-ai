import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL } from './session-test-helpers'

test('shares one auth.me cache entry across home and login while authenticated', async () => {
  let meRequestCount = 0
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () => {
      meRequestCount += 1
      return HttpResponse.json({ data: ACTIVE_USER })
    }),
  )
  const { router } = renderApp('/')
  await screen.findByText(ACTIVE_USER.email)
  const countAfterHome = meRequestCount
  await router.navigate({ to: '/login' })
  expect(await screen.findByText(ACTIVE_USER.email)).toBeInTheDocument()
  expect(meRequestCount).toBe(countAfterHome)
})
