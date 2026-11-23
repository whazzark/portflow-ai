import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { StartProblemDto } from '@/features/discharges/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  API_BASE_URL,
  buildStartProblem,
  startableDetail,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeDetail,
  mockDischargePlanning,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const DETAIL = startableDetail()
const HOLDER = { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar' }
const LOT_PROBLEM = buildStartProblem({ subject: { type: 'PRODUCT_LOT', id: 'lot-wheat' } })
const SHIFT_PROBLEM = buildStartProblem({
  code: 'SHIFT_WITHOUT_TRUCK',
  subject: { type: 'SHIFT', id: 'shift-first' },
})
const DOCK_PROBLEM = buildStartProblem({
  family: 'ACTIVE_DISCHARGE_CONFLICT',
  code: 'DOCK_HELD',
  subject: { type: 'DOCK', id: DETAIL.dock.id },
  holder: HOLDER,
})

function mockStartProblems(problems: StartProblemDto[], user = ACTIVE_OPERATIONS_LEAD) {
  return mockDischargeDetail({ user, details: [DETAIL], startProblems: problems })
}

const tab = (name: RegExp) => screen.findByRole('tab', { name })

test('says how many problems block the start, and opens the confirmation on review', async () => {
  mockStartProblems([LOT_PROBLEM, SHIFT_PROBLEM])

  renderDischargeTab(DETAIL.id, 'overview')

  // The banner is the title's parent, holding the review action beside it.
  const banner = (await screen.findByText('2 problems block the start'))
    .parentElement as HTMLElement
  expect(banner).toHaveAttribute('role', 'status')
  fireEvent.click(within(banner).getByRole('button', { name: 'Review' }))

  const dialog = await screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('2 problems to fix')
})

test('says a single problem in the singular', async () => {
  mockStartProblems([LOT_PROBLEM])

  renderDischargeTab(DETAIL.id, 'overview')

  expect(await screen.findByText('1 problem blocks the start')).toBeInTheDocument()
})

test('shows neither banner nor problem marks when nothing blocks the start', async () => {
  const checks = mockStartProblems([])

  renderDischargeTab(DETAIL.id, 'overview')
  await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })
  await waitFor(() => expect(checks.requests).toBeGreaterThan(0))

  expect(screen.queryByText(/blocks? the start/)).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /contains a problem/ })).not.toBeInTheDocument()
})

test('marks each tab holding a problem, once, in words', async () => {
  mockStartProblems([DOCK_PROBLEM, LOT_PROBLEM, SHIFT_PROBLEM, SHIFT_PROBLEM])

  renderDischargeTab(DETAIL.id, 'overview')

  expect(await tab(/^Overview, contains a problem$/)).toBeInTheDocument()
  expect(await tab(/^Product lots \(2\), contains a problem$/)).toBeInTheDocument()
  expect(await tab(/^Shifts \(\d+\), contains a problem$/)).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /^Truck pool \(1\)$/ })).toBeInTheDocument()
})

test('leaves the page whole, without banner or marks, when the start check fails', async () => {
  mockDischargeDetail({ user: ACTIVE_OPERATIONS_LEAD, details: [DETAIL], startCheckFails: true })

  renderDischargeTab(DETAIL.id, 'overview')
  await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })

  expect(screen.queryByText(/blocks? the start/)).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /contains a problem/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  expect(await screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })).toBeInTheDocument()
})

test('asks nothing about the start for someone who may not start it', async () => {
  const checks = mockStartProblems([LOT_PROBLEM], ACTIVE_OBSERVER)

  renderDischargeTab(DETAIL.id, 'overview')
  await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })
  await screen.findByRole('tab', { name: /^Product lots/ })

  expect(checks.requests).toBe(0)
  expect(screen.queryByText(/blocks? the start/)).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /contains a problem/ })).not.toBeInTheDocument()
})

test('follows the plan: a change saved from the page asks again what blocks the start', async () => {
  const planning = mockDischargePlanning({ detail: DETAIL })
  // The lot's problem is fixed once its doors are saved, as the API would then answer.
  server.use(
    http.get(`${API_BASE_URL}/api/v1/discharges/:id/start-check`, () =>
      HttpResponse.json({
        data: {
          dischargeId: DETAIL.id,
          shiftId: null,
          problems: planning.lotDoorRequests.length > 0 ? [] : [LOT_PROBLEM],
        },
      }),
    ),
  )

  renderDischargeTab(DETAIL.id, 'product-lots')
  expect(await tab(/^Product lots \(2\), contains a problem$/)).toBeInTheDocument()

  const menu = await openLotMenu('Cargill France · Blé tendre')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Assign doors' }))
  const dialog = await screen.findByRole('dialog', { name: 'Warehouse doors' })
  fireEvent.click(
    await within(within(dialog).getByRole('region', { name: 'Available' })).findByRole('button', {
      name: 'Add',
      description: /^Door A2/,
    }),
  )
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(await tab(/^Product lots \(2\)$/)).toBeInTheDocument()
  expect(screen.queryByText(/blocks? the start/)).not.toBeInTheDocument()
})
