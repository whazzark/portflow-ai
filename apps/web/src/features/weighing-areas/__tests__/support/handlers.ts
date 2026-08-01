import { HttpResponse, http } from 'msw'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'

export function weighingAreasHandler(areas: WeighingAreaDto[]) {
  return http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => HttpResponse.json({ data: areas }))
}

export function weighingAreasErrorHandler(status = 503) {
  return http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
    HttpResponse.json({ error: { code: 'E_WEIGHING_AREAS_UNAVAILABLE' } }, { status }),
  )
}

export function weighingAreasSequenceHandler(
  responses: Array<{ areas: WeighingAreaDto[] } | { errorStatus: number }>,
) {
  let requestIndex = 0

  return http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => {
    const response = responses[Math.min(requestIndex, responses.length - 1)]
    requestIndex += 1
    return 'areas' in response
      ? HttpResponse.json({ data: response.areas })
      : HttpResponse.json(
          { error: { code: 'E_WEIGHING_AREAS_UNAVAILABLE' } },
          { status: response.errorStatus },
        )
  })
}
