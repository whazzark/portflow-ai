import { screen } from '@testing-library/react'
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
  if (!initialPath.startsWith('/checkpoints')) {
    return renderApp(initialPath)
  }
  if (initialPath.includes('status=')) {
    return renderApp(initialPath)
  }
  return renderApp(`${initialPath}${initialPath.includes('?') ? '&' : '?'}status=all`)
}

/** Starts a placement from the toolbar's Create menu, as an administrator would. */
export async function startCreating(
  user: { click: (element: Element) => Promise<void> },
  item: 'New dock' | 'New weighing area',
) {
  await user.click(await screen.findByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(`^${item}`) }))
}

/** Enters bulk select mode from the toolbar's Select menu. */
export async function startSelecting(
  user: { click: (element: Element) => Promise<void> },
  kind: 'docks' | 'weighing areas',
) {
  await user.click(await screen.findByRole('button', { name: 'Select' }))
  await user.click(await screen.findByRole('menuitem', { name: `Select ${kind}` }))
}
