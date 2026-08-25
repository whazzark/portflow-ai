import { HttpResponse, http } from 'msw'
import type { WarehouseDto } from '@/features/warehouses/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { API_BASE_URL, WAREHOUSE_ADMIN, WAREHOUSES } from './fixtures'
import { warehousesHandler } from './handlers'

export function mockWarehouses(
  user: Record<string, unknown> = WAREHOUSE_ADMIN,
  warehouses: WarehouseDto[] = WAREHOUSES,
) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    warehousesHandler(warehouses),
  )
}

export function renderWarehouses(initialPath = '/warehouses') {
  return renderApp(
    initialPath.includes('status=')
      ? initialPath
      : `${initialPath}${initialPath.includes('?') ? '&' : '?'}status=all`,
  )
}
