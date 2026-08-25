import { HttpResponse, http } from 'msw'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { API_BASE_URL, WAREHOUSE_ADMIN, WAREHOUSES } from './fixtures'
import { warehousesHandler } from './handlers'

export function mockWarehouses(
  user: Record<string, unknown> = WAREHOUSE_ADMIN,
  warehouses: WarehouseWithDoorsDto[] = WAREHOUSES,
) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    warehousesHandler(warehouses),
  )
}

/** Defaults to the `all` status filter so both lifecycle states are on screen without a test
 * having to switch views first. */
export function renderWarehouses(initialPath = '/warehouses') {
  if (!initialPath.startsWith('/warehouses') || initialPath.includes('status=')) {
    return renderApp(initialPath)
  }

  return renderApp(`${initialPath}${initialPath.includes('?') ? '&' : '?'}status=all`)
}
