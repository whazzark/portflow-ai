import { HttpResponse, http } from 'msw'
import { API_BASE_URL, DOCK_ADMIN, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import type { DockDto } from '@/features/docks/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

export function mockDocks(user = DOCK_ADMIN, docks: DockDto[] = DOCKS) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: docks })),
  )
}

export function renderCheckpoints(initialPath = '/checkpoints') {
  return renderApp(initialPath)
}
