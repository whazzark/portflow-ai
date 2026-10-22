import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import {
  formatShiftDay,
  formatShiftDuration,
  formatShiftPeriod,
  formatShiftTime,
} from '@/features/discharges/discharge-detail-view'
import { formatDateTime } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  activeDischargeDetail,
  DISCHARGES,
} from '../support/fixtures'
import { mockDischargeDetail, mockDockOccupancy, renderDischargeTab } from '../support/test-helpers'

function betweenShifts() {
  const discharge = activeDischargeDetail()

  return {
    ...discharge,
    shifts: discharge.shifts.map((shift) =>
      shift.status === 'ACTIVE' ? { ...shift, status: 'COMPLETED' as const } : shift,
    ),
  }
}

test('leads the overview with the active shift, who is responsible, and what it uses now', async () => {
  const discharge = activeDischargeDetail()
  const active = discharge.shifts[5]
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(within(screen.getByRole('tabpanel')).getAllByRole('region')[0]).toBe(card)
  expect(within(card).getByText('Active')).toBeInTheDocument()
  expect(card).toHaveTextContent(
    `Shift 6 of 14 · ${formatShiftPeriod(active)} · ${formatShiftDuration(active)}`,
  )
  expect(card).toHaveTextContent(`Started ${formatDateTime(active.actualStartAt)}`)
  expect(card).toHaveTextContent('ResponsibleClaire Martin')
  expect(within(card).getByRole('list', { name: 'Trucks (2)' })).toHaveTextContent(
    'PN-552-PFQV-569-PF',
  )
  expect(within(card).getByRole('list', { name: 'Warehouse doors (2)' })).toHaveTextContent(
    'Porte DouanePorte Nord',
  )
  expect(within(card).getByRole('list', { name: 'Weighing areas (1)' })).toHaveTextContent(
    'Pont-bascule Nord',
  )
})

test('names the next shift with its responsible and what it will use', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent(
    `Next: ${formatShiftPeriod(discharge.shifts[6])} · Sophie Dubois · 6 trucks, 1 door, 1 weighing area`,
  )
})

test('says no further shift is planned after the last one', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [{ ...discharge, shifts: discharge.shifts.slice(0, 6) }] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent('No further shift planned')
  expect(card).not.toHaveTextContent('Next:')
})

test('between two shifts, says no shift is active and names the last and the next ones', async () => {
  const discharge = betweenShifts()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent('No shift is active')
  expect(card).toHaveTextContent(`Last: ${formatShiftPeriod(discharge.shifts[5])}`)
  expect(card).toHaveTextContent(`Next: ${formatShiftPeriod(discharge.shifts[6])}`)
  expect(within(card).queryByText('Responsible')).not.toBeInTheDocument()
})

test('offers a preparer to add a shift once nothing is planned any more, and nobody else', async () => {
  const discharge = betweenShifts()
  const finished = { ...discharge, shifts: discharge.shifts.slice(0, 6) }
  mockDischargeDetail({ user: ACTIVE_OPERATIONS_LEAD, details: [finished] })

  const view = renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent('No further shift planned')
  await userEvent.setup().click(within(card).getByRole('button', { name: 'Add shift' }))
  expect(await screen.findByRole('dialog', { name: 'Add shift' })).toBeInTheDocument()
  view.unmount()

  mockDischargeDetail({ user: ACTIVE_OBSERVER, details: [finished] })
  renderDischargeTab(discharge.id, 'overview')

  const observed = await screen.findByRole('region', { name: 'Current shift' })
  expect(within(observed).queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('keeps an archived door readable on the card and says it is archived', async () => {
  const discharge = activeDischargeDetail()
  const active = discharge.shifts[5]
  const archived = {
    ...active,
    warehouseDoors: active.warehouseDoors.map((membership, index) =>
      index === 0
        ? {
            ...membership,
            warehouseDoor: { ...membership.warehouseDoor, status: 'ARCHIVED' as const },
          }
        : membership,
    ),
  }
  mockDischargeDetail({
    details: [
      {
        ...discharge,
        shifts: discharge.shifts.map((shift) => (shift === active ? archived : shift)),
      },
    ],
  })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(within(card).getByRole('list', { name: 'Warehouse doors (2)' })).toHaveTextContent(
    'Porte DouaneArchived',
  )
})

test('opens the active shift in the shifts section', async () => {
  const discharge = activeDischargeDetail()
  const active = discharge.shifts[5]
  mockDischargeDetail({ details: [discharge] })

  const { router } = renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  await userEvent.setup().click(within(card).getByRole('link', { name: 'Open in Shifts' }))

  expect(
    await screen.findByRole('dialog', { name: `Shift ${formatShiftPeriod(active)}` }),
  ).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ tab: 'shifts', shiftId: 'shift-6' })
})

const HOUR_MS = 3_600_000

/** Two hours into the scenario's active shift, as the timeline's now. */
function freezeNow(discharge = activeDischargeDetail(), hours = 2) {
  const now = new Date(Date.parse(discharge.shifts[5].actualStartAt ?? '') + hours * HOUR_MS)
  vi.useFakeTimers({ toFake: ['Date'], now })

  return now
}

afterEach(() => {
  vi.useRealTimers()
})

const pad = (value: number) => String(value).padStart(2, '0')
const nowLabel = (now: Date) =>
  `Now ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`

test('places the discharge on its dock after the current shift card', async () => {
  const discharge = activeDischargeDetail({
    startedBy: { id: 'lead-1', firstName: 'Léa', lastName: 'Martin' },
  })
  freezeNow(discharge)
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const timeline = await screen.findByRole('region', { name: 'Dock timeline · Quai Est' })
  const regions = screen.getAllByRole('region')
  expect(regions.indexOf(timeline)).toBe(
    regions.indexOf(screen.getByRole('region', { name: 'Current shift' })) + 1,
  )
  expect(within(timeline).getByRole('list', { name: 'Legend' })).toHaveTextContent(
    'CompletedIn progressPlanned',
  )
  expect(timeline).toHaveTextContent(
    `Started ${formatDateTime(discharge.startedAt)} by Léa Martin · planned until ${formatDateTime(discharge.shifts[13].plannedEndAt)}`,
  )
  expect(timeline).toHaveTextContent('Shifts5 of 14 completed')
})

test('draws every shift of the discharge and tells the one in progress', async () => {
  const discharge = activeDischargeDetail()
  freezeNow(discharge)
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const timeline = await screen.findByRole('region', { name: 'Dock timeline · Quai Est' })
  const shifts = within(timeline).getByRole('list', { name: 'Shifts of MV Ocean Cedar' })
  const blocks = within(shifts).getAllByRole('listitem')
  expect(blocks).toHaveLength(14)
  expect(blocks[0]).toHaveAccessibleName(`Completed, ${formatShiftPeriod(discharge.shifts[0])}`)
  expect(blocks[5]).toHaveAccessibleName(`In progress, ${formatShiftPeriod(discharge.shifts[5])}`)
  expect(blocks[6]).toHaveAccessibleName(`Planned, ${formatShiftPeriod(discharge.shifts[6])}`)
})

test('says when the shift in progress has run past its planned end', async () => {
  const discharge = activeDischargeDetail()
  freezeNow(discharge, 9)
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const timeline = await screen.findByRole('region', { name: 'Dock timeline · Quai Est' })
  const shifts = within(timeline).getByRole('list', { name: 'Shifts of MV Ocean Cedar' })
  expect(within(shifts).getAllByRole('listitem')[5]).toHaveAccessibleName(
    `In progress, ${formatShiftPeriod(discharge.shifts[5])}, past its planned end`,
  )
})

test('marks now on the timeline', async () => {
  const discharge = activeDischargeDetail()
  const now = freezeNow(discharge)
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const timeline = await screen.findByRole('region', { name: 'Dock timeline · Quai Est' })
  expect(within(timeline).getByText(nowLabel(now))).toBeInTheDocument()
})

test('shows the other discharges holding the dock after this one', async () => {
  const discharge = activeDischargeDetail()
  freezeNow(discharge)
  const docks: Array<string | null> = []
  mockDischargeDetail({ details: [discharge] })
  mockDockOccupancy({
    onRequest: (dockId) => docks.push(dockId),
    occupancy: [
      {
        discharge: { id: discharge.id, vesselName: discharge.vesselName, status: 'ACTIVE' },
        startAt: discharge.shifts[0].plannedStartAt ?? '',
        endAt: discharge.shifts[13].plannedEndAt ?? '',
      },
      {
        discharge: { id: 'nordic', vesselName: 'MV Nordic Breeze', status: 'PLANNED' },
        startAt: discharge.shifts[13].plannedStartAt ?? '',
        endAt: discharge.shifts[13].plannedEndAt ?? '',
      },
    ],
  })

  renderDischargeTab(discharge.id, 'overview')

  const timeline = await screen.findByRole('region', { name: 'Dock timeline · Quai Est' })
  const lanes = within(timeline).getByRole('list', { name: 'Discharges on the dock' })
  await within(lanes).findByRole('listitem', { name: 'MV Nordic Breeze' })
  expect(
    within(lanes)
      .getAllByRole('listitem', { name: /^MV / })
      .map((lane) => lane.firstElementChild?.textContent),
  ).toEqual(['MV Ocean Cedar', 'MV Nordic Breeze'])
  expect(docks).toContain('dock-est')
})

test('keeps its own lane when the dock occupancy cannot be read', async () => {
  const discharge = activeDischargeDetail()
  freezeNow(discharge)
  mockDischargeDetail({ details: [discharge] })
  mockDockOccupancy({ failTimes: 5 })

  renderDischargeTab(discharge.id, 'overview')

  const timeline = await screen.findByRole('region', { name: 'Dock timeline · Quai Est' })
  expect(
    within(timeline).getByRole('list', { name: 'Shifts of MV Ocean Cedar' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Current shift' })).toBeInTheDocument()
})

test.each(['product-lots', 'truck-pool', 'shifts'] as const)(
  'does not repeat the dock timeline on %s',
  async (tab) => {
    const discharge = activeDischargeDetail()
    mockDischargeDetail({ details: [discharge] })

    renderDischargeTab(discharge.id, tab)

    await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })
    expect(screen.queryByRole('region', { name: /^Dock timeline/ })).not.toBeInTheDocument()
  },
)

test('ends the overview with the progress of the shifts, the product lots, and the truck pool', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const progress = await screen.findByRole('region', { name: 'Progress' })
  expect(within(screen.getByRole('tabpanel')).getAllByRole('region').at(-1)).toBe(progress)
  expect(progress).toHaveTextContent('Read-only while active, except adding shifts')
  expect(progress).toHaveTextContent('14 shifts · 5 completed · 1 active · 8 planned')
  expect(progress).toHaveTextContent(
    `Ends ${formatShiftDay(new Date(discharge.shifts[13].plannedEndAt ?? ''))} at ${formatShiftTime(discharge.shifts[13].plannedEndAt)} as planned`,
  )
  expect(progress).toHaveTextContent('5 lots · 5 customers · 16,790.500 t')
  expect(progress).toHaveTextContent(
    '2 with a warehouse door (Porte Douane, Porte Nord) · 3 without',
  )
  expect(progress).toHaveTextContent('9 trucks held')
  expect(progress).toHaveTextContent(
    `1 released on ${formatDateTime(discharge.truckPool.at(-1)?.releasedAt ?? null)} (CC-303-PF)`,
  )
})

test.each([
  ['Shifts', 'shifts'],
  ['Product lots', 'product-lots'],
  ['Truck pool', 'truck-pool'],
] as const)('opens the %s section from the progress card', async (link, tab) => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  const { router } = renderDischargeTab(discharge.id, 'overview')

  const progress = await screen.findByRole('region', { name: 'Progress' })
  await userEvent.setup().click(within(progress).getByRole('link', { name: link }))

  expect(await screen.findByRole('tab', { name: new RegExp(`^${link}`) })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(router.state.location.search).toMatchObject({ tab })
})

test.each([
  ['planned', 'MV Atlantic Dawn'],
  ['closed', 'MV Loire Star'],
] as const)(
  'shows neither the current shift nor the progress on a %s discharge',
  async (_, vessel) => {
    mockDischargeDetail()
    const listed = DISCHARGES.find(
      (discharge) => discharge.vesselName === vessel && discharge.status !== 'ACTIVE',
    )

    renderDischargeTab(listed?.id ?? '', 'overview')

    await screen.findByRole('heading', { level: 1, name: vessel })
    expect(screen.queryByRole('region', { name: 'Current shift' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Progress' })).not.toBeInTheDocument()
  },
)
