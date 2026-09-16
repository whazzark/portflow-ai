import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const START = '2026-10-04T06:00:00.000Z'
const END = '2026-10-04T14:00:00.000Z'
const PERIOD = formatShiftPeriod({ plannedStartAt: START, plannedEndAt: END })
const STARTED_PERIOD = formatShiftPeriod({
  plannedStartAt: '2026-10-05T06:00:00.000Z',
  plannedEndAt: '2026-10-05T14:00:00.000Z',
})

const selection = { effectiveFrom: '2026-09-07T08:00:00.000Z', effectiveTo: null }

const current = (
  truckId: string,
  registration: string,
  truckStatus: 'AVAILABLE' | 'SUSPENDED' = 'AVAILABLE',
) => ({ id: `row-${truckId}`, truckId, registration, truckStatus, ...selection })

const MAGASIN_A = { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' as const }

const POOL = [
  buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' }),
  buildPoolEntry({ id: 'pool-b', truckId: 'truck-b', registration: 'BB-200-BB' }),
  buildPoolEntry({
    id: 'pool-s',
    truckId: 'truck-s',
    registration: 'SU-300-SP',
    truckStatus: 'SUSPENDED',
  }),
  buildPoolEntry({
    id: 'pool-idle',
    truckId: 'truck-idle',
    registration: 'ID-400-LE',
    truckStatus: 'SUSPENDED',
  }),
]

/** A shift only uses doors a lot of its discharge holds; Door B1 is held by none. */
const WHEAT = buildLot({
  id: 'lot-wheat',
  productName: 'Blé tendre',
  doorAssignments: [
    buildDoorPeriod({ id: 'wheat-a1' }),
    buildDoorPeriod({
      id: 'wheat-a2',
      warehouseDoor: { id: 'door-a2', name: 'Door A2', status: 'AVAILABLE' },
    }),
    buildDoorPeriod({
      id: 'wheat-a3',
      warehouseDoor: { id: 'door-a3', name: 'Door A3', status: 'ARCHIVED' },
    }),
  ],
})

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT],
  truckPool: POOL,
  shifts: [
    buildShift({
      id: 'shift-1',
      plannedStartAt: START,
      plannedEndAt: END,
      trucks: [current('truck-a', 'AA-100-AA'), current('truck-s', 'SU-300-SP', 'SUSPENDED')],
      warehouseDoors: [
        {
          id: 'row-door-a1',
          warehouseDoor: { id: 'door-a1', name: 'Door A1', status: 'AVAILABLE' },
          warehouse: MAGASIN_A,
          ...selection,
        },
        {
          id: 'row-door-a3',
          warehouseDoor: { id: 'door-a3', name: 'Door A3', status: 'ARCHIVED' },
          warehouse: MAGASIN_A,
          ...selection,
        },
      ],
      weighingAreas: [
        {
          id: 'row-area-north',
          weighingArea: { id: 'area-north', name: 'North scale', status: 'AVAILABLE' },
          ...selection,
        },
      ],
    }),
    buildShift({
      id: 'shift-2',
      plannedStartAt: '2026-10-04T14:00:00.000Z',
      plannedEndAt: '2026-10-04T22:00:00.000Z',
    }),
    buildShift({
      id: 'shift-started',
      status: 'ACTIVE',
      plannedStartAt: '2026-10-05T06:00:00.000Z',
      plannedEndAt: '2026-10-05T14:00:00.000Z',
    }),
  ],
})

/** Opens a shift's panel from the calendar. */
async function openShiftPanel(period = PERIOD) {
  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  fireEvent.click(within(shifts).getByRole('button', { name: `Shift ${period}` }))

  return screen.findByRole('dialog', { name: `Shift ${period}` })
}

/** Opens the planned shift's panel, then its correction, once its choices have loaded. */
async function openShiftEdit() {
  const panel = await openShiftPanel()
  fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }))

  const sheet = await screen.findByRole('dialog', { name: 'Edit shift' })
  await within(sheet).findByRole('checkbox', { name: 'Select Magasin A › Door A2' })
  await within(sheet).findByRole('checkbox', { name: 'Select South scale' })

  return sheet
}

const save = (sheet: HTMLElement) =>
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

test('offers the correction only on planned shifts', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')

  const started = await openShiftPanel(STARTED_PERIOD)
  expect(within(started).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  // The panel is modal: it is closed before another shift is chosen on the calendar.
  fireEvent.click(within(started).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const planned = await openShiftPanel()
  expect(within(planned).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

test('offers no correction to an observer', async () => {
  mockTruckPlanning({ user: ACTIVE_OBSERVER, detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')

  const panel = await openShiftPanel()
  expect(within(panel).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('opens on the shift as it stands', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  expect(within(sheet).getByLabelText(/^Planned start/)).toHaveValue(toDateTimeLocalValue(START))
  expect(within(sheet).getByLabelText(/^Planned end/)).toHaveValue(toDateTimeLocalValue(END))
  expect(within(sheet).getByRole('combobox', { name: /^Responsible/ })).toHaveValue('Léa Martin')
  expect(within(sheet).getByRole('checkbox', { name: 'Select AA-100-AA' })).toBeChecked()
  expect(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' })).not.toBeChecked()
  expect(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A1' })).toBeChecked()
  expect(within(sheet).getByRole('checkbox', { name: 'Select North scale' })).toBeChecked()
  // Neither a suspended truck nor an archived door is offered unless the shift already uses it.
  expect(
    within(sheet).queryByRole('checkbox', { name: 'Select ID-400-LE' }),
  ).not.toBeInTheDocument()
  expect(
    within(sheet).queryByRole('checkbox', { name: 'Select Magasin B › Door B1' }),
  ).not.toBeInTheDocument()
})

test('returns to the shift details without saving anything', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Back to details' }))

  const panel = await screen.findByRole('dialog', { name: `Shift ${PERIOD}` })
  expect(within(panel).getByRole('list', { name: 'Trucks' })).not.toHaveTextContent('BB-200-BB')
  expect(state.requests).toEqual([])
})

test('corrects the period, the responsible, and every resource of the shift at once', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()
  const newStart = '2026-10-04T05:00'
  const newEnd = '2026-10-04T13:00'

  change(within(sheet).getByLabelText(/^Planned start/), newStart)
  change(within(sheet).getByLabelText(/^Planned end/), newEnd)
  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A3' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select North scale' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select South scale' }))
  save(sheet)

  expect(await screen.findByText('Shift updated')).toBeInTheDocument()
  expect(state.requests).toEqual([
    {
      kind: 'shift',
      shiftId: 'shift-1',
      body: {
        plannedStartAt: fromDateTimeLocalValue(newStart),
        plannedEndAt: fromDateTimeLocalValue(newEnd),
        responsibleUserId: 'responsible-thomas',
        truckIds: ['truck-b', 'truck-s'],
        warehouseDoorIds: ['door-a1', 'door-a2'],
        weighingAreaIds: ['area-south'],
      },
    },
  ])

  // Back to the shift's details, which read the saved correction.
  const shift = await screen.findByRole('dialog', {
    name: `Shift ${formatShiftPeriod({
      plannedStartAt: fromDateTimeLocalValue(newStart),
      plannedEndAt: fromDateTimeLocalValue(newEnd),
    })}`,
  })
  expect(shift).toHaveTextContent('Thomas Bernard')
  expect(within(shift).getByRole('list', { name: 'Trucks' })).toHaveTextContent('BB-200-BB')
  expect(within(shift).getByRole('list', { name: 'Warehouse doors' })).toHaveTextContent('Door A2')
  expect(within(shift).getByRole('list', { name: 'Weighing areas' })).toHaveTextContent(
    'South scale',
  )
})

test('lets a suspended truck or an archived door already selected go, but not be chosen again', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  const suspended = within(sheet).getByRole('checkbox', { name: 'Select SU-300-SP' })
  expect(suspended).toBeChecked()
  fireEvent.click(suspended)
  expect(suspended).not.toBeChecked()
  expect(suspended).toHaveAttribute('aria-disabled', 'true')
  expect(within(sheet).getByText('Suspended trucks cannot be newly selected')).toBeInTheDocument()

  const archived = within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A3' })
  expect(archived).toBeChecked()
  fireEvent.click(archived)
  expect(archived).not.toBeChecked()
  expect(archived).toHaveAttribute('aria-disabled', 'true')
  expect(
    within(sheet).getByText('Archived doors and doors no lot holds cannot be newly selected'),
  ).toBeInTheDocument()
})

test('offers only the doors a lot of the discharge holds, each with its lot', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  expect(
    within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' }),
  ).toHaveAccessibleDescription('Cargill France · Blé tendre')
  expect(
    within(sheet).queryByRole('checkbox', { name: 'Select Magasin B › Door B1' }),
  ).not.toBeInTheDocument()
})

test('lets a selected door no lot holds any more go, but not be chosen again', async () => {
  const released = {
    ...PLANNED,
    productLots: [
      {
        ...WHEAT,
        doorAssignments: WHEAT.doorAssignments.filter((row) => row.id !== 'wheat-a1'),
      },
    ],
  }
  mockTruckPlanning({ detail: released })
  renderDischargeTab(released.id, 'shifts')
  const sheet = await openShiftEdit()

  const doorA1 = within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A1' })
  expect(doorA1).toBeChecked()
  expect(doorA1).toHaveAccessibleDescription(/^No lot holds this door/)
  fireEvent.click(doorA1)
  expect(doorA1).not.toBeChecked()
  expect(doorA1).toHaveAttribute('aria-disabled', 'true')
})

test('points to the product lots when no lot holds a door', async () => {
  const noDoors = {
    ...PLANNED,
    productLots: [{ ...WHEAT, doorAssignments: [] }],
    shifts: [buildShift({ id: 'shift-1', plannedStartAt: START, plannedEndAt: END })],
  }
  mockTruckPlanning({ detail: noDoors })
  renderDischargeTab(noDoors.id, 'shifts')
  const panel = await openShiftPanel()
  fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }))
  const sheet = await screen.findByRole('dialog', { name: 'Edit shift' })

  expect(await within(sheet).findByText('No door is assigned to a product lot')).toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('link', { name: 'Go to product lots' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('region', { name: 'Product lots' })).toBeInTheDocument()
})

test('shows a door refused as held by no lot on its row', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToShift: (_shiftId, body) => ({
      status: 422,
      body: {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            {
              field: `warehouseDoorIds.${body.warehouseDoorIds.indexOf('door-a2')}`,
              rule: 'assignedWarehouseDoor',
              message: 'This warehouse door is not assigned to a product lot of this discharge',
            },
          ],
        },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' }))
  save(sheet)

  await waitFor(() =>
    expect(
      within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' }),
    ).toHaveAccessibleDescription(
      'Cargill France · Blé tendre This warehouse door is not assigned to a product lot of this discharge',
    ),
  )
})

test('selects every truck it can at once', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select all trucks' }))

  expect(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' })).toBeChecked()
  expect(within(sheet).getByText('3 selected')).toBeInTheDocument()
})

test('points to the pool when the discharge holds no truck', async () => {
  const empty = {
    ...PLANNED,
    truckPool: [],
    shifts: [buildShift({ id: 'shift-1', plannedStartAt: START, plannedEndAt: END })],
  }
  mockTruckPlanning({ detail: empty })
  renderDischargeTab(empty.id, 'shifts')
  const sheet = await openShiftEdit()

  expect(within(sheet).getByText('No trucks reserved')).toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('link', { name: 'Go to truck pool' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
})

test('refuses a period overlapping another shift before sending it', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  change(
    within(sheet).getByLabelText(/^Planned end/),
    toDateTimeLocalValue('2026-10-04T16:00:00.000Z'),
  )
  save(sheet)

  expect(await within(sheet).findByText('This shift overlaps another shift')).toBeInTheDocument()
  expect(state.requests).toEqual([])
})

test('shows each refusal on the value it concerns', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToShift: (_shiftId, body) => ({
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
              field: `warehouseDoorIds.${body.warehouseDoorIds.indexOf('door-a2')}`,
              rule: 'availableWarehouseDoor',
              message: 'This door is no longer available',
            },
          ],
        },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' }))
  save(sheet)

  const alert = await within(sheet).findByText('Some warehouse doors can no longer be selected')
  await waitFor(() => expect(alert.closest('[role="alert"]')).toHaveFocus())
  expect(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' })).toBeChecked()
  expect(
    within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A2' }),
  ).toHaveAccessibleDescription('Cargill France · Blé tendre This door is no longer available')
  expect(
    within(sheet).getByText('This user can no longer be responsible for a shift'),
  ).toBeInTheDocument()
})

test('leaves the correction and refreshes when the shift is no longer planned', async () => {
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToShift: () => ({
      status: 404,
      body: { error: { code: 'E_SHIFT_NOT_FOUND', message: 'Shift not found' } },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()
  const before = state.detailRequests

  save(sheet)

  expect(await screen.findByText('This shift is no longer planned')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit shift' })).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(before))
})

test('leaves the correction when the discharge has started meanwhile', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToShift: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_DISCHARGE_NOT_PLANNED',
          message: 'Only a planned discharge can be corrected',
        },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  save(sheet)

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
})

test('keeps the correction when it could not be saved', async () => {
  mockTruckPlanning({ detail: PLANNED, respondToShift: () => 'network-error' })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftEdit()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  save(sheet)

  expect(await screen.findByText('Unable to update the shift')).toBeInTheDocument()
  expect(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' })).toBeChecked()
})
