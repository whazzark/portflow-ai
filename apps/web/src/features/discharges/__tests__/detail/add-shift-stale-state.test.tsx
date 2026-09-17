import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  chooseOption,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const FIRST = {
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
}
const ADDED_MEANWHILE = {
  plannedStartAt: '2026-10-04T14:00:00.000Z',
  plannedEndAt: '2026-10-04T22:00:00.000Z',
}

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  truckPool: [buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' })],
  shifts: [buildShift({ id: 'shift-1', ...FIRST })],
})

async function openAddShift() {
  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  fireEvent.click(within(shifts).getByRole('button', { name: 'Add shift' }))

  return screen.findByRole('dialog', { name: 'Add shift' })
}

const submit = (sheet: HTMLElement) =>
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add shift' }))

test('keeps the period and responsible, dropping the resources, once the discharge has started', async () => {
  let started = false
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToAddShift: (body) => {
      if (body.truckIds === undefined) {
        return undefined
      }
      started = true
      state.current = { ...state.current, status: 'ACTIVE' }

      return {
        status: 409,
        body: {
          error: {
            code: 'E_DISCHARGE_NOT_PLANNED',
            message: 'Only a planned discharge can be changed',
          },
        },
      }
    },
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select AA-100-AA' }))
  submit(sheet)

  expect(await screen.findByText('This discharge has started')).toBeInTheDocument()
  expect(started).toBe(true)
  await waitFor(() =>
    expect(
      within(sheet).queryByRole('checkbox', { name: 'Select AA-100-AA' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('dialog', { name: 'Add shift' })).toBeInTheDocument()
  expect(within(sheet).getByRole('combobox', { name: /^Responsible/ })).toHaveValue(
    'Thomas Bernard',
  )

  submit(sheet)
  expect(await screen.findByText('Shift added')).toBeInTheDocument()
  const last = state.requests.at(-1)
  expect(last?.kind === 'add-shift' && last.body).not.toHaveProperty('truckIds')
})

test('closes the addition once the discharge is closed', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToAddShift: () => ({
      status: 409,
      body: {
        error: { code: 'E_DISCHARGE_CLOSED', message: 'A closed discharge receives no new shift' },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  submit(sheet)

  expect(await screen.findByText('This discharge is closed')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Add shift' })).not.toBeInTheDocument(),
  )
})

test('shows the shift another user added in the way', async () => {
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToAddShift: () => {
      state.current = {
        ...state.current,
        shifts: [
          ...state.current.shifts,
          buildShift({ id: 'shift-meanwhile', ...ADDED_MEANWHILE }),
        ],
      }

      return {
        status: 422,
        body: {
          error: {
            code: 'E_VALIDATION_ERROR',
            message: 'Validation failure',
            details: [
              {
                field: 'plannedStartAt',
                rule: 'shiftOverlap',
                message: 'This shift overlaps another shift',
              },
            ],
          },
        },
      }
    },
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  submit(sheet)

  expect(await within(sheet).findByText('This shift overlaps another shift')).toBeInTheDocument()
  const shifts = screen.getByRole('region', { name: 'Shifts', hidden: true })
  await waitFor(() =>
    expect(
      within(shifts).getByRole('button', {
        name: `Shift ${formatShiftPeriod(ADDED_MEANWHILE)}`,
        hidden: true,
      }),
    ).toBeInTheDocument(),
  )
})
