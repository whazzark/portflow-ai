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

test('reviews what the discharge would start with before anything changes', async () => {
  const detail = startableDetail()
  mockDischargeStart({ detail })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()

  expect(dialog).toHaveTextContent(detail.dock.name)
  expect(dialog).toHaveTextContent('Cargill France')
  expect(dialog).toHaveTextContent('Blé tendre')
  expect(dialog).toHaveTextContent('Door A1 · Magasin A')
  expect(dialog).toHaveTextContent('Soufflet Négoce')
  expect(dialog).toHaveTextContent('Door B1 · Magasin B')
  expect(dialog).toHaveTextContent('1 truck held')

  const shift = await within(dialog).findByRole('region', { name: 'Shift to start' })
  expect(shift).toHaveTextContent(formatShiftPeriod(detail.shifts[0]))
  expect(shift).toHaveTextContent('Léa Martin')
  expect(shift).toHaveTextContent('AA-100-AA')
  expect(shift).toHaveTextContent('Door A1 · Magasin A')
  expect(shift).toHaveTextContent('Pont-bascule Nord')
})

test('names a lot without a warehouse door in the review', async () => {
  const detail = startableDetail()
  detail.productLots[1].doorAssignments = []
  mockDischargeStart({ detail })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()

  expect(dialog).toHaveTextContent('No warehouse door')
})

test('folds the review away behind the problems, and shows it directly without any', async () => {
  const detail = startableDetail()
  mockDischargeStart({
    detail,
    respondToCheck: () => ({
      problems: [
        buildStartProblem({
          code: 'SHIFT_WITHOUT_TRUCK',
          subject: { type: 'SHIFT', id: 'shift-first' },
        }),
      ],
    }),
  })
  const view = renderDischargeDetail(detail.id)

  const blocked = await openStart()
  await within(blocked).findByRole('alert')
  const disclosure = within(blocked).getByText('Preparation to start').closest('details')
  expect(disclosure).not.toHaveAttribute('open')
  expect(disclosure).toContainElement(
    within(blocked).getByRole('region', { name: 'Shift to start' }),
  )
  view.unmount()

  mockDischargeStart({ detail })
  renderDischargeDetail(detail.id)

  const ready = await openStart()
  await waitFor(() =>
    expect(within(ready).getByRole('button', { name: 'Start discharge' })).toBeEnabled(),
  )
  expect(within(ready).queryByText('Preparation to start')).not.toBeInTheDocument()
})

test('focuses Cancel first, and cancelling starts nothing', async () => {
  const detail = startableDetail()
  const state = mockDischargeStart({ detail })
  renderDischargeDetail(detail.id)

  const dialog = await openStart()
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())

  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.startRequests).toBe(0)
  expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
})

test('keeps Start discharge disabled while the check loads', async () => {
  const detail = startableDetail()
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  mockDischargeStart({ detail })
  const { server } = await import('@/test/msw/server')
  const { http, HttpResponse } = await import('msw')
  server.use(
    http.get('*/api/v1/discharges/:id/start-check', async () => {
      await held
      return HttpResponse.json({
        data: { dischargeId: detail.id, shiftId: 'shift-first', problems: [] },
      })
    }),
  )
  renderDischargeDetail(detail.id)

  const dialog = await openStart()

  expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeDisabled()
  // Which shift starts is the check's answer: until it arrives, the review does not guess.
  expect(within(dialog).queryByText('No planned shift')).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Checking the shift to start')).toBeInTheDocument()
  release()
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Start discharge' })).toBeEnabled(),
  )
  expect(within(dialog).queryByLabelText('Checking the shift to start')).not.toBeInTheDocument()
})
