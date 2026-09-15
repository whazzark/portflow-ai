import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  listedDischarge,
  TRUCK_CANDIDATES,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const PERIOD = formatShiftPeriod({
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
})

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  truckPool: [
    buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' }),
    buildPoolEntry({ id: 'pool-x', truckId: 'truck-x', registration: 'XX-900-XX' }),
  ],
  shifts: [buildShift({ id: 'shift-1' })],
})

const withoutTruck = (detail: DischargeDetailDto, truckId: string): DischargeDetailDto => ({
  ...detail,
  truckPool: detail.truckPool.filter((entry) => entry.truckId !== truckId),
})

function refusal(rule: string, message: string) {
  return {
    status: 422,
    body: {
      error: {
        code: 'E_VALIDATION_ERROR',
        message: 'Validation failure',
        details: [{ field: 'truckIds.0', rule, message }],
      },
    },
  }
}

test('keeps a truck withdrawn elsewhere on the shift correction, refused, until it is unchecked', async () => {
  let refused = false
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToShift: (_shiftId, { truckIds }) => {
      if (!refused && truckIds.includes('truck-x')) {
        refused = true
        state.current = withoutTruck(state.current, 'truck-x')
        return refusal('heldTruck', "This truck is no longer in this discharge's pool")
      }
      return undefined
    },
  })
  renderDischargeTab(PLANNED.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  fireEvent.click(within(shifts).getByRole('button', { name: `Shift ${PERIOD}` }))
  const panel = await screen.findByRole('dialog', { name: `Shift ${PERIOD}` })
  fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }))
  const sheet = await screen.findByRole('dialog', { name: 'Edit shift' })
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select XX-900-XX' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  const alert = await within(sheet).findByText('Some trucks can no longer be selected')
  await waitFor(() => expect(alert.closest('[role="alert"]')).toHaveFocus())
  const refusedTruck = within(sheet).getByRole('checkbox', { name: 'Select XX-900-XX' })
  expect(refusedTruck).toBeChecked()
  expect(
    within(sheet).getByText("This truck is no longer in this discharge's pool"),
  ).toBeInTheDocument()

  fireEvent.click(refusedTruck)
  await waitFor(() => expect(refusedTruck).toHaveAttribute('aria-disabled', 'true'))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Shift updated')).toBeInTheDocument()
  expect(state.requests.at(-1)).toMatchObject({
    kind: 'shift',
    shiftId: 'shift-1',
    body: { truckIds: ['truck-a'] },
  })
})

test('keeps a truck suspended elsewhere selected on the add sheet until it is unchecked', async () => {
  const candidates = [...TRUCK_CANDIDATES]
  mockTruckPlanning({
    detail: PLANNED,
    candidates,
    respondToReserve: () => {
      candidates.splice(
        candidates.findIndex((candidate) => candidate.id === 'candidate-port'),
        1,
      )
      return refusal('availableTruck', 'This truck is no longer available to reserve')
    },
  })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  fireEvent.click(within(pool).getByRole('button', { name: 'Add trucks' }))
  const sheet = await screen.findByRole('dialog', { name: 'Add trucks' })
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select PO-303-RT' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  expect(
    await within(sheet).findByText('This truck is no longer available to reserve'),
  ).toBeInTheDocument()
  const refusedTruck = within(sheet).getByRole('checkbox', { name: 'Select PO-303-RT' })
  expect(refusedTruck).toBeChecked()

  fireEvent.click(refusedTruck)
  await waitFor(() =>
    expect(
      within(sheet).queryByRole('checkbox', { name: 'Select PO-303-RT' }),
    ).not.toBeInTheDocument(),
  )
})

test('drops the pool actions once the discharge turns out to have started', async () => {
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToWithdraw: () => {
      state.current = { ...state.current, status: 'ACTIVE' }
      return {
        status: 409,
        body: {
          error: {
            code: 'E_DISCHARGE_NOT_PLANNED',
            message: 'Only a planned discharge can be corrected',
          },
        },
      }
    },
  })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  fireEvent.click(within(pool).getByRole('button', { name: 'Withdraw AA-100-AA' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw truck?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', { name: 'Truck pool' })).queryByRole('checkbox'),
    ).not.toBeInTheDocument(),
  )
})

test('sends one reservation when Reserve is pressed twice', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  fireEvent.click(within(pool).getByRole('button', { name: 'Add trucks' }))
  const sheet = await screen.findByRole('dialog', { name: 'Add trucks' })
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select LO-202-RE' }))
  const reserve = within(sheet).getByRole('button', { name: 'Reserve' })
  fireEvent.click(reserve)
  fireEvent.click(reserve)

  expect(await screen.findByText('Truck reserved')).toBeInTheDocument()
  expect(state.requests.filter((request) => request.kind === 'reserve')).toHaveLength(1)
})

test('counts only trucks still held once the pool refreshes without one of them', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  fireEvent.click(within(pool).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(pool).getByRole('checkbox', { name: 'Select XX-900-XX' }))
  expect(within(pool).getByRole('button', { name: 'Withdraw (2)' })).toBeInTheDocument()

  // Another user withdraws XX-900-XX; this page learns it from its next write's answer.
  state.current = withoutTruck(state.current, 'truck-x')
  fireEvent.click(within(pool).getByRole('button', { name: 'Add trucks' }))
  const sheet = await screen.findByRole('dialog', { name: 'Add trucks' })
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select LO-202-RE' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  expect(await screen.findByText('Truck reserved')).toBeInTheDocument()
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', { name: 'Truck pool' })).getByRole('button', {
        name: 'Withdraw (1)',
      }),
    ).toBeInTheDocument(),
  )
})
