import { HttpResponse, http } from 'msw'
import type { WarehouseDto } from '@/features/warehouses/types'
import { API_BASE_URL } from './fixtures'

export function warehousesHandler(warehouses: WarehouseDto[]) {
  return http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json({ data: warehouses }),
  )
}

export function warehousesErrorHandler(status = 503) {
  return http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json({ error: { code: 'E_WAREHOUSES_UNAVAILABLE' } }, { status }),
  )
}

export function warehousesSequenceHandler(
  responses: Array<{ warehouses: WarehouseDto[] } | { errorStatus: number }>,
) {
  let requestIndex = 0

  return http.get(`${API_BASE_URL}/api/v1/warehouses`, () => {
    const response = responses[Math.min(requestIndex, responses.length - 1)]
    requestIndex += 1
    return 'warehouses' in response
      ? HttpResponse.json({ data: response.warehouses })
      : HttpResponse.json(
          { error: { code: 'E_WAREHOUSES_UNAVAILABLE' } },
          { status: response.errorStatus },
        )
  })
}

export function createWarehouseHandler(created: WarehouseDto) {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json({ data: created }, { status: 201 }),
  )
}

export function createWarehouseConflictHandler() {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'E_WAREHOUSE_NAME_CONFLICT',
          message: 'Warehouse name is already in use',
        },
      },
      { status: 409 },
    ),
  )
}

export function createWarehouseInvalidFootprintHandler() {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'E_WAREHOUSE_INVALID_FOOTPRINT',
          message: 'Warehouse footprint outline must not cross itself',
        },
      },
      { status: 422 },
    ),
  )
}

export function createWarehouseFailureHandler(status = 500) {
  return http.post(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
      { status },
    ),
  )
}
