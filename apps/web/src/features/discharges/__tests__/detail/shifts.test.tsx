import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  buildDischargeDetail,
  buildDoorPeriod,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

async function renderShifts(overrides: Partial<DischargeDetailDto>, search = '') {
  // Expected on the morning the shifts start, so the calendar opens on their first day.
  mockDischargeDetail({
    details: [
      buildDischargeDetail(OCEAN_CEDAR, {
        expectedStartAt: '2026-10-04T06:00:00.000Z',
        ...overrides,
      }),
    ],
  })
  const { router } = renderDischargeTab(OCEAN_CEDAR.id, 'shifts', search)

  return { region: await screen.findByRole('region', { name: 'Shifts' }), router }
}

const DAY_SHIFT = buildShift({
  id: 'day',
  status: 'COMPLETED',
  trucks: [
    {
      id: 'truck-row',
      truckId: 'truck-1',
      registration: 'AB-123-CD',
      truckStatus: 'AVAILABLE',
      effectiveFrom: '2026-10-04T06:00:00.000Z',
      // A finished shift's trucks have all ended, and it still counts them.
      effectiveTo: '2026-10-04T14:00:00.000Z',
    },
  ],
})
const EVENING_SHIFT = buildShift({
  id: 'evening',
  plannedStartAt: '2026-10-04T14:30:00.000Z',
  plannedEndAt: '2026-10-04T22:00:00.000Z',
  responsible: { id: 'lead-2', firstName: 'Hugo', lastName: 'Bernard' },
  status: 'ACTIVE',
})
const NIGHT_SHIFT = buildShift({
  id: 'night',
  plannedStartAt: '2026-10-04T22:30:00.000Z',
  plannedEndAt: '2026-10-05T06:00:00.000Z',
  responsible: { id: 'lead-3', firstName: 'Inès', lastName: 'Roux' },
})

const shiftName = (shift: DischargeDetailDto['shifts'][number]) =>
  `Shift ${formatShiftPeriod(shift)}`

test('lays the shifts out on the calendar in planned order, each with its status, responsible, and trucks', async () => {
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })

  const calendar = within(region).getByRole('list', { name: 'Shift calendar' })
  const bars = within(calendar).getAllByRole('button')
  expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
    shiftName(DAY_SHIFT),
    shiftName(EVENING_SHIFT),
    shiftName(NIGHT_SHIFT),
  ])
  expect(bars[0]).toHaveAccessibleDescription(/Completed.*Léa Martin.*1 truck$/)
  expect(bars[1]).toHaveAccessibleDescription(/Active.*Hugo Bernard.*0 trucks$/)
})

test('keeps one control for a shift cut across two columns of the calendar', async () => {
  // The calendar's first column runs from 06:00 to 06:00, which this shift works through.
  const dawnShift = buildShift({
    id: 'dawn',
    plannedStartAt: '2026-10-05T04:00:00.000Z',
    plannedEndAt: '2026-10-05T08:00:00.000Z',
  })
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, dawnShift] })

  const calendar = within(region).getByRole('list', { name: 'Shift calendar' })
  expect(within(calendar).getAllByRole('button')).toHaveLength(2)
  expect(within(calendar).getAllByRole('button', { name: shiftName(dawnShift) })).toHaveLength(1)
})

test('names a shift worked past midnight by both of its days', async () => {
  const { region } = await renderShifts({ shifts: [NIGHT_SHIFT] })

  expect(within(region).getByRole('article')).toHaveAccessibleName(
    `Shift ${formatShiftPeriod(NIGHT_SHIFT)}`,
  )
})

test('flags a planned shift with no truck selected yet', async () => {
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, NIGHT_SHIFT] })

  const calendar = within(region).getByRole('list', { name: 'Shift calendar' })
  expect(
    within(calendar).getByRole('button', { name: shiftName(NIGHT_SHIFT) }),
  ).toHaveAccessibleDescription(/No truck selected$/)
  expect(
    within(calendar).getByRole('button', { name: shiftName(DAY_SHIFT) }),
  ).not.toHaveAccessibleDescription(/No truck selected/)
})

test('opens the shift under way, else the next planned one, and shows only its detail', async () => {
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })

  const shifts = region
  expect(within(shifts).getByRole('button', { name: shiftName(EVENING_SHIFT) })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(shifts).getByRole('article')).toHaveAccessibleName(shiftName(EVENING_SHIFT))
  expect(within(shifts).getByRole('article')).toHaveTextContent('Hugo Bernard')
})

test('opens the chosen shift in the address, without adding a history entry', async () => {
  const user = userEvent.setup()
  const { region, router } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })
  const shifts = region
  const historyLength = router.history.length

  await user.click(within(shifts).getByRole('button', { name: shiftName(DAY_SHIFT) }))

  expect(within(shifts).getByRole('article')).toHaveAccessibleName(shiftName(DAY_SHIFT))
  expect(within(shifts).getByRole('button', { name: shiftName(DAY_SHIFT) })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(router.state.location.search).toMatchObject({ tab: 'shifts', shiftId: 'day' })
  expect(router.history.length).toBe(historyLength)
})

test('opens the shift a shared address names', async () => {
  const { region } = await renderShifts(
    { shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] },
    '?shiftId=night',
  )

  expect(within(region).getByRole('article')).toHaveAccessibleName(shiftName(NIGHT_SHIFT))
})

test('falls back to the default shift when the address names a shift the discharge no longer has', async () => {
  const { region } = await renderShifts(
    { shifts: [DAY_SHIFT, EVENING_SHIFT] },
    // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
    '?shiftId=removed',
  )

  expect(within(region).getByRole('article')).toHaveAccessibleName(shiftName(EVENING_SHIFT))
})

test('forgets the open shift when leaving the shifts section', async () => {
  const user = userEvent.setup()
  const { router } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT] }, '?shiftId=day')

  await user.click(screen.getByRole('tab', { name: /^Product lots/ }))

  await screen.findByRole('region', { name: 'Product lots' })
  expect(router.state.location.search).not.toHaveProperty('shiftId')
})

test('shows the trucks, doors, and weighing areas of a shift with their periods', async () => {
  const { region } = await renderShifts({
    shifts: [
      buildShift({
        trucks: [
          {
            id: 'truck-ended',
            truckId: 'truck-2',
            registration: 'EF-456-GH',
            truckStatus: 'AVAILABLE',
            effectiveFrom: '2026-10-04T06:00:00.000Z',
            effectiveTo: '2026-10-04T09:00:00.000Z',
          },
          {
            id: 'truck-open',
            truckId: 'truck-1',
            registration: 'AB-123-CD',
            truckStatus: 'SUSPENDED',
            effectiveFrom: '2026-10-04T06:00:00.000Z',
            effectiveTo: null,
          },
        ],
        warehouseDoors: [buildDoorPeriod()],
        weighingAreas: [
          {
            id: 'weighing-open',
            effectiveFrom: '2026-10-04T06:00:00.000Z',
            effectiveTo: null,
            weighingArea: { id: 'area-1', name: 'Pont-bascule Nord', status: 'ARCHIVED' },
          },
        ],
      }),
    ],
  })

  const trucks = within(region).getByRole('list', { name: 'Trucks' })
  const doors = within(region).getByRole('list', { name: 'Warehouse doors' })
  const areas = within(region).getByRole('list', { name: 'Weighing areas' })
  const truckItems = within(trucks).getAllByRole('listitem')
  // In effect first, then ended.
  expect(truckItems[0]).toHaveTextContent('AB-123-CD')
  expect(truckItems[0]).toHaveTextContent('Suspended')
  expect(truckItems[1]).toHaveTextContent('EF-456-GH')
  expect(truckItems[1]).toHaveTextContent('Ended')
  expect(within(doors).getByRole('listitem')).toHaveTextContent('Magasin A › Door A1')
  expect(within(areas).getByRole('listitem')).toHaveTextContent('Pont-bascule Nord')
  expect(within(areas).getByRole('listitem')).toHaveTextContent('Archived')
})

test('says which kinds of resource a shift has none of yet', async () => {
  const { region } = await renderShifts({ shifts: [buildShift()] })

  const shift = within(region).getByRole('article')
  expect(within(shift).getAllByText('None selected')).toHaveLength(3)
  expect(within(shift).queryByRole('list')).not.toBeInTheDocument()
})

test('says so when the discharge has no shift', async () => {
  const { region } = await renderShifts({ shifts: [] })

  expect(within(region).getByText('No shifts planned')).toBeInTheDocument()
  expect(within(region).queryByRole('article')).not.toBeInTheDocument()
})

test("shows a closed discharge's shift resources left without an end as ended", async () => {
  const { region } = await renderShifts({
    status: 'CLOSED',
    shifts: [buildShift({ status: 'COMPLETED', warehouseDoors: [buildDoorPeriod()] })],
  })

  const door = within(within(region).getByRole('list', { name: 'Warehouse doors' })).getByRole(
    'listitem',
  )
  expect(door).toHaveTextContent('Ended')
  expect(door).toHaveTextContent('end not recorded')
  expect(door).not.toHaveTextContent('Since')
})

test('offers no truck selection on the shifts of a closed discharge, even to a preparer', async () => {
  const closed = listedDischarge('MV Loire Star', 'CLOSED')
  mockDischargeDetail({
    user: ACTIVE_OPERATIONS_LEAD,
    details: [buildDischargeDetail(closed, { shifts: [buildShift({ status: 'COMPLETED' })] })],
  })
  renderDischargeTab(closed.id, 'shifts')

  const region = await screen.findByRole('region', { name: 'Shifts' })
  expect(within(region).queryByRole('button', { name: /^Edit trucks/ })).not.toBeInTheDocument()
})

test('points a preparer to the truck pool while the discharge holds no truck', async () => {
  const user = userEvent.setup()
  const planned = listedDischarge('MV Atlantic Dawn', 'PLANNED')
  mockDischargeDetail({
    user: ACTIVE_OPERATIONS_LEAD,
    details: [buildDischargeDetail(planned, { shifts: [buildShift()] })],
  })
  renderDischargeTab(planned.id, 'shifts')

  const region = await screen.findByRole('region', { name: 'Shifts' })
  expect(region).toHaveTextContent('No truck is reserved for this discharge yet.')
  await user.click(within(region).getByRole('link', { name: 'Go to truck pool' }))

  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  expect(within(pool).getAllByRole('button', { name: 'Add trucks' }).length).toBeGreaterThan(0)
})

test.each([
  ['an observer', ACTIVE_OBSERVER, 'PLANNED'],
  ['a preparer on an active discharge', ACTIVE_OPERATIONS_LEAD, 'ACTIVE'],
] as const)('gives %s no pointer to the truck pool', async (_case, user, status) => {
  const listed = listedDischarge(
    status === 'PLANNED' ? 'MV Atlantic Dawn' : 'MV Ocean Cedar',
    status,
  )
  mockDischargeDetail({ user, details: [buildDischargeDetail(listed, { shifts: [buildShift()] })] })
  renderDischargeTab(listed.id, 'shifts')

  const region = await screen.findByRole('region', { name: 'Shifts' })
  expect(within(region).queryByRole('link', { name: 'Go to truck pool' })).not.toBeInTheDocument()
})
