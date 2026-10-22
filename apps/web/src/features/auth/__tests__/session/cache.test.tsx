import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { findUserMenuTrigger } from '@/test/user-menu'
import { ACTIVE_USER, API_BASE_URL } from './helpers'

test('shares one auth.me cache entry across home and login while authenticated', async () => {
  let meRequestCount = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => {
      meRequestCount += 1
      return HttpResponse.json({ data: ACTIVE_USER })
    }),
  )
  const { router } = renderApp('/')
  await findUserMenuTrigger(ACTIVE_USER)
  const countAfterHome = meRequestCount
  await router.navigate({ to: '/login' })
  expect(await findUserMenuTrigger(ACTIVE_USER)).toBeInTheDocument()
  expect(meRequestCount).toBe(countAfterHome)
})
