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
