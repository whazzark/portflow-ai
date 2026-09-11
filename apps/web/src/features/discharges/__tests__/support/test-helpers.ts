import { screen, within } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'

import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDetailDto, DischargeDto } from '@/features/discharges/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_OBSERVER, API_BASE_URL, DISCHARGE_DETAILS, DISCHARGES } from './fixtures'

type MockDischargesOptions = {
  user?: SessionUser
  discharges?: DischargeDto[]
  onRequest?: () => void
  /** Fail the collection this many times before answering, to exercise retry. */
  failTimes?: number
}

export function mockDischarges({
  user = ACTIVE_OBSERVER,
  discharges = DISCHARGES,
  onRequest,
  failTimes = 0,
}: MockDischargesOptions = {}) {
  let remainingFailures = failTimes

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/discharges`, () => {
      onRequest?.()

      if (remainingFailures > 0) {
        remainingFailures -= 1

        return new HttpResponse(null, { status: 500 })
      }

      return HttpResponse.json({ data: discharges })
    }),
  )
}

type MockDischargeDetailOptions = {
  user?: SessionUser
  details?: DischargeDetailDto[]
  /** Answer every detail request with the discharge not-found error. */
  notFound?: boolean
  /** Fail the detail this many times before answering, to exercise retry. */
  failTimes?: number
  /** Hold every answer back this long, to observe the pending state. */
  delayMs?: number
  onRequest?: (id: string) => void
}

export function mockDischargeDetail({
  user = ACTIVE_OBSERVER,
  details = DISCHARGE_DETAILS,
  notFound = false,
  failTimes = 0,
  delayMs = 0,
  onRequest,
}: MockDischargeDetailOptions = {}) {
  let remainingFailures = failTimes

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/discharges/:id`, async ({ params }) => {
      const id = String(params.id)
      onRequest?.(id)

      if (delayMs > 0) {
        await delay(delayMs)
      }

      if (remainingFailures > 0) {
        remainingFailures -= 1

        return new HttpResponse(null, { status: 500 })
      }

      const detail = details.find((candidate) => candidate.id === id)

      if (notFound || !detail) {
        return HttpResponse.json(
          { error: { code: 'E_DISCHARGE_NOT_FOUND', message: 'Discharge not found' } },
          { status: 404 },
        )
      }

      return HttpResponse.json({ data: detail })
    }),
  )
}

export function renderDischarges(path = '/discharges') {
  return renderApp(path)
}

export function renderDischargeDetail(id: string, search = '') {
  return renderApp(`/discharges/${id}${search}`)
}

export function dischargeTab(name: RegExp | string) {
  return screen.getByRole('tab', { name })
}

export async function findDischargeRows() {
  const table = await screen.findByRole('table', { name: 'Discharges' })

  return within(table).getAllByRole('row').slice(1)
}
