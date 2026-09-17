import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { toDateTimeLocalValue } from '@/helpers/dates'
import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  type AddShiftBody,
  allowFormJourneyTime,
  change,
  chooseOption,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const FIRST = {
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
}

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [
    buildLot({ id: 'lot-wheat', doorAssignments: [buildDoorPeriod({ id: 'wheat-a1' })] }),
  ],
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

test('refuses missing values before sending anything', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  change(within(sheet).getByLabelText(/^Planned start/), '')
  submit(sheet)

  expect(await within(sheet).findByText('Planned start is required.')).toBeInTheDocument()
  expect(within(sheet).getByText('Responsible is required.')).toBeInTheDocument()
  expect(state.requests).toEqual([])
})

test('refuses an inverted period and an overlap before sending anything', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()
  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')

  change(
    within(sheet).getByLabelText(/^Planned start/),
    toDateTimeLocalValue('2026-10-04T10:00:00.000Z'),
  )
  change(
    within(sheet).getByLabelText(/^Planned end/),
    toDateTimeLocalValue('2026-10-04T18:00:00.000Z'),
  )
  submit(sheet)
  expect(
    await within(sheet).findByText(`This shift overlaps shift ${formatShiftPeriod(FIRST)}`),
  ).toBeInTheDocument()

  change(
    within(sheet).getByLabelText(/^Planned end/),
    toDateTimeLocalValue('2026-10-04T09:00:00.000Z'),
  )
  expect(
    await within(sheet).findByText('The planned end must be after the planned start'),
  ).toBeInTheDocument()
  expect(state.requests).toEqual([])
})

test('shows every refusal of the API on the value it concerns, keeping what was entered', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToAddShift: (body: AddShiftBody) => ({
      status: 422,
      body: {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            {
              field: 'responsibleUserId',
              rule: 'eligibleShiftResponsible',
              message: 'This user can no longer be responsible for a shift',
            },
            {
              field: `truckIds.${body.truckIds?.indexOf('truck-a')}`,
              rule: 'selectableTruck',
              message: 'This truck is suspended',
            },
            {
              field: `warehouseDoorIds.${body.warehouseDoorIds?.indexOf('door-a1')}`,
              rule: 'availableWarehouseDoor',
              message: 'This warehouse door is no longer available',
            },
          ],
        },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A1' }))
  submit(sheet)

  const alert = await within(sheet).findByText('Some trucks can no longer be selected')
  await waitFor(() => expect(alert.closest('[role="alert"]')).toHaveFocus())
  expect(
    within(sheet).getByText('Some warehouse doors can no longer be selected'),
  ).toBeInTheDocument()
  expect(
    within(sheet).getByText('This user can no longer be responsible for a shift'),
  ).toBeInTheDocument()
  expect(within(sheet).getByRole('checkbox', { name: 'Select AA-100-AA' })).toBeChecked()
  expect(
    within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A1' }),
  ).toHaveAccessibleDescription(/This warehouse door is no longer available/)
  expect(within(sheet).getByLabelText(/^Planned start/)).toHaveValue(
    toDateTimeLocalValue(FIRST.plannedEndAt),
  )
})

test('keeps the addition and its identity when it could not be saved', async () => {
  let failures = 1
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToAddShift: () => {
      if (failures > 0) {
        failures -= 1

        return 'network-error'
      }

      return undefined
    },
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  submit(sheet)

  expect(await screen.findByText('Unable to add the shift')).toBeInTheDocument()
  expect(within(sheet).getByRole('combobox', { name: /^Responsible/ })).toHaveValue(
    'Thomas Bernard',
  )

  submit(sheet)
  expect(await screen.findByText('Shift added')).toBeInTheDocument()
  const ids = state.requests.flatMap((request) =>
    request.kind === 'add-shift' ? [request.body.id] : [],
  )
  expect(ids).toHaveLength(2)
  expect(ids[1]).toBe(ids[0])
})
