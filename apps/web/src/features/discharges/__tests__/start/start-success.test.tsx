import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { formatDateTime } from '@/helpers/dates'

import { startableDetail } from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeDetail,
  mockDischargeStart,
  renderDischargeDetail,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const STARTED_AT = '2026-10-04T05:47:00.000Z'

test('starts the discharge and its first shift, then shows them started', async () => {
  const detail = startableDetail()
  const state = mockDischargeStart({ detail, startDelayMs: 50 })
  renderDischargeDetail(detail.id)

  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
  const dialog = await screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })
  const confirm = within(dialog).getByRole('button', { name: 'Start discharge' })
  await waitFor(() => expect(confirm).toBeEnabled())

  fireEvent.click(confirm)

  expect(await within(dialog).findByRole('button', { name: 'Starting…' })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.startRequests).toBe(1)
  expect(await screen.findByText('Discharge started')).toBeInTheDocument()
  // The Start button is gone with the dialog, so focus lands where the new status is announced.
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })).toHaveFocus(),
  )
  expect(screen.getByText(/Started/).closest('div')).toHaveTextContent(
    `Started${formatDateTime(STARTED_AT)} by Olivia Observer`,
  )
  expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Preparation' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('shows who started a shift and when in its panel', async () => {
  const detail = startableDetail()
  const startedBy = { id: 'lead-1', firstName: 'Léa', lastName: 'Martin' }
  const started = {
    ...detail,
    status: 'ACTIVE' as const,
    startedAt: STARTED_AT,
    startedBy,
    shifts: detail.shifts.map((shift, index) =>
      index === 0
        ? { ...shift, status: 'ACTIVE' as const, actualStartAt: STARTED_AT, startedBy }
        : shift,
    ),
  }
  mockDischargeDetail({ details: [started] })
  renderDischargeTab(detail.id, 'shifts', '?shiftId=shift-first')

  const panel = await screen.findByRole('dialog', {
    name: `Shift ${formatShiftPeriod(detail.shifts[0])}`,
  })

  expect(panel).toHaveTextContent(`Actual start${formatDateTime(STARTED_AT)}`)
  expect(panel).toHaveTextContent('Started byLéa Martin')
})
