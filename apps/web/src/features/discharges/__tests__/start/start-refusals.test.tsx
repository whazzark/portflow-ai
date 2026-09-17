import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'

import { buildStartProblem, startableDetail } from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeStart,
  renderDischargeDetail,
} from '../support/test-helpers'

allowFormJourneyTime()

async function openStart() {
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

  return screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })
}

async function confirmStart(dialog: HTMLElement) {
  const confirm = within(dialog).getByRole('button', { name: 'Start discharge' })
  await waitFor(() => expect(confirm).toBeEnabled())
  fireEvent.click(confirm)
}

test('groups problems by kind of element, in the section order of the detail', async () => {
  const detail = startableDetail()
  mockDischargeStart({
    detail,
    respondToCheck: () => ({
      problems: [
        buildStartProblem({
          family: 'ACTIVE_DISCHARGE_CONFLICT',
          code: 'DOCK_HELD',
          subject: { type: 'DOCK', id: detail.dock.id },
          holder: { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar' },
        }),
        buildStartProblem({
          family: 'INELIGIBLE_RESPONSIBLE',
          code: 'RESPONSIBLE_INELIGIBLE',
          subject: { type: 'USER', id: 'lead-1' },
          context: { type: 'SHIFT', id: 'shift-first' },
        }),
        buildStartProblem({
          family: 'UNAVAILABLE_REFERENCE',
          code: 'DOCK_ARCHIVED',
          subject: { type: 'DOCK', id: detail.dock.id },
        }),
        buildStartProblem({
          code: 'LOT_WITHOUT_WAREHOUSE_DOOR',
          subject: { type: 'PRODUCT_LOT', id: 'lot-barley' },
        }),
      ],
    }),
  })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('4 problems to fix')
  expect(
    within(dialog)
      .getAllByRole('heading', { level: 3 })
      // The folded review below has headings of its own.
      .filter((heading) => !heading.closest('details'))
      .map((heading) => heading.textContent),
  ).toEqual(['Dock', 'Product lots', 'Shifts'])
})

const GAPS = [
  buildStartProblem({ code: 'SHIFT_WITHOUT_TRUCK', subject: { type: 'SHIFT', id: 'shift-first' } }),
  buildStartProblem({
    code: 'LOT_WITHOUT_WAREHOUSE_DOOR',
    subject: { type: 'PRODUCT_LOT', id: 'lot-barley' },
  }),
]

test('follows a shift problem to that shift', async () => {
  const detail = startableDetail()
  mockDischargeStart({ detail, respondToCheck: () => ({ problems: GAPS }) })
  const { router } = renderDischargeDetail(detail.id)

  const dialog = await openStart()
  fireEvent.click(
    await within(dialog).findByRole('link', {
      name: `Shift ${formatShiftPeriod(detail.shifts[0])}`,
    }),
  )

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ tab: 'shifts', shiftId: 'shift-first' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Start MV Atlantic Dawn' }),
    ).not.toBeInTheDocument(),
  )
})

test('follows a lot problem to the product lots', async () => {
  const detail = startableDetail()
  mockDischargeStart({ detail, respondToCheck: () => ({ problems: GAPS }) })
  const { router } = renderDischargeDetail(detail.id)

  const dialog = await openStart()
  fireEvent.click(await within(dialog).findByRole('link', { name: 'Open Product lots' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: 'product-lots' }))
})

test('shows a failed check with a retry, and no start until it succeeds', async () => {
  const detail = startableDetail()
  let failures = 1
  const state = mockDischargeStart({
    detail,
    respondToCheck: () => {
      if (failures > 0) {
        failures -= 1
        return { status: 500, body: {} }
      }
      return { problems: [] }
    },
  })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()

  expect(await within(dialog).findByText('Unable to check this discharge.')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeDisabled()
  expect(within(dialog).queryByText('No planned shift')).not.toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))

  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeEnabled(),
  )
  expect(state.checkRequests).toBe(2)
})

test('keeps the review open after a failure unrelated to the preparation', async () => {
  const detail = startableDetail()
  mockDischargeStart({ detail, respondToStart: () => 'network-error' })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()
  await confirmStart(dialog)

  expect(
    await within(dialog).findByText('Unable to start this discharge. Try again.'),
  ).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeEnabled()
})

test('keeps the review open and checks again when the discharge changed meanwhile', async () => {
  const detail = startableDetail()
  const state = mockDischargeStart({
    detail,
    respondToStart: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_DISCHARGE_PLANNING_CONFLICT',
          message: 'This discharge changed meanwhile',
        },
      },
    }),
  })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()
  await waitFor(() => expect(state.checkRequests).toBe(1))
  await confirmStart(dialog)

  expect(
    await screen.findByText('This discharge changed meanwhile. Check its doors and try again.'),
  ).toBeInTheDocument()
  await waitFor(() => expect(state.checkRequests).toBe(2))
  expect(screen.getByRole('dialog', { name: 'Start MV Atlantic Dawn' })).toBeInTheDocument()
})
