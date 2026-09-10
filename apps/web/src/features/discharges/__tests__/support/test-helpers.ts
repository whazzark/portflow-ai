import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'

import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDto } from '@/features/discharges/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_OBSERVER, API_BASE_URL, DISCHARGES } from './fixtures'

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

export function renderDischarges(path = '/discharges') {
  return renderApp(path)
}

export function dischargeTab(name: RegExp | string) {
  return screen.getByRole('tab', { name })
}

export async function findDischargeRows() {
  const table = await screen.findByRole('table', { name: 'Discharges' })

  return within(table).getAllByRole('row').slice(1)
}
