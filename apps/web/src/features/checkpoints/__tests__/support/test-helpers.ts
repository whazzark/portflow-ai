import { HttpResponse, http } from 'msw'
import { API_BASE_URL, DOCK_ADMIN, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import type { DockDto } from '@/features/docks/types'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { weighingAreasHandler } from '@/features/weighing-areas/__tests__/support/handlers'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

export function mockDocks(
  user = DOCK_ADMIN,
  docks: DockDto[] = DOCKS,
  weighingAreas: WeighingAreaDto[] = WEIGHING_AREAS,
) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: docks })),
    weighingAreasHandler(weighingAreas),
  )
}

export function renderCheckpoints(initialPath = '/checkpoints') {
  return renderApp(initialPath)
}
