import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
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

  // Found even behind a shift panel the address opens: the panel is modal and hides the page from
  // assistive technology while it is open.
  return { region: await screen.findByRole('region', { name: 'Shifts', hidden: true }), router }
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

async function openPanel(region: HTMLElement, shift: DischargeDetailDto['shifts'][number]) {
  await userEvent.click(within(region).getByRole('button', { name: shiftName(shift) }))

  return screen.findByRole('dialog', { name: shiftName(shift) })
}

/** The value a detail field reads, by its label. */
const field = (panel: HTMLElement, label: string) =>
  within(panel).getByText(label, { selector: 'dt' }).nextElementSibling

test('lays the shifts out on the calendar in planned order, each with its status, length, responsible, and resources', async () => {
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })

  const calendar = within(region).getByRole('list', { name: 'Shift calendar' })
  const bars = within(calendar).getAllByRole('button')
  expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
    shiftName(DAY_SHIFT),
    shiftName(EVENING_SHIFT),
    shiftName(NIGHT_SHIFT),
  ])
  expect(bars[0]).toHaveAccessibleDescription(
    'Completed, 8 h, Léa Martin, 1 truck, 0 warehouse doors, 0 weighing areas',
  )
  expect(bars[1]).toHaveAccessibleDescription(
    'Active, 7 h 30 min, Hugo Bernard, 0 trucks, 0 warehouse doors, 0 weighing areas',
  )
})

test('counts the warehouse doors and weighing areas a shift uses on its card', async () => {
  const equipped = buildShift({
    id: 'equipped',
    status: 'ACTIVE',
    warehouseDoors: [buildDoorPeriod()],
    weighingAreas: [
      {
        id: 'weighing-open',
        effectiveFrom: '2026-10-04T06:00:00.000Z',
        effectiveTo: null,
        weighingArea: { id: 'area-1', name: 'Pont-bascule Nord', status: 'AVAILABLE' },
      },
    ],
  })
  const { region } = await renderShifts({ shifts: [equipped] })

  const card = within(region).getByRole('button', { name: shiftName(equipped) })
  expect(card).toHaveAccessibleDescription(/, 1 warehouse door, 1 weighing area$/)
})

test('keeps one control for a shift cut across two columns of the calendar', async () => {
  // Each column of the calendar ends at midnight, local to wherever the suite runs, which this
  // shift works through.
  const lateShift = buildShift({
    id: 'late',
    plannedStartAt: new Date(2026, 9, 4, 22).toISOString(),
    plannedEndAt: new Date(2026, 9, 5, 4).toISOString(),
  })
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, lateShift] })

  const calendar = within(region).getByRole('list', { name: 'Shift calendar' })
  expect(within(calendar).getAllByRole('button')).toHaveLength(2)
  expect(within(calendar).getAllByRole('button', { name: shiftName(lateShift) })).toHaveLength(1)
})

test('names a shift worked past midnight by both of its days', async () => {
  const { region } = await renderShifts({ shifts: [NIGHT_SHIFT] })

  expect(await openPanel(region, NIGHT_SHIFT)).toBeInTheDocument()
})

test('flags a planned shift with no truck selected yet', async () => {
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, NIGHT_SHIFT] })

  const calendar = within(region).getByRole('list', { name: 'Shift calendar' })
  const night = within(calendar).getByRole('button', { name: shiftName(NIGHT_SHIFT) })
  const day = within(calendar).getByRole('button', { name: shiftName(DAY_SHIFT) })
  expect(night).toHaveAccessibleDescription(/No truck selected$/)
  // Written on the card itself, not only announced.
  expect(night).toHaveTextContent('No truck')
  expect(day).not.toHaveAccessibleDescription(/No truck selected/)
  expect(day).not.toHaveTextContent('No truck')
})

test('opens no panel until a shift is chosen', async () => {
  const { region } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  for (const button of within(region).getAllByRole('button', { name: /^Shift / })) {
    expect(button).toHaveAttribute('aria-pressed', 'false')
  }
})

test('opens the chosen shift in a panel and the address, without adding a history entry', async () => {
  const { region, router } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })
  const historyLength = router.history.length

  const panel = await openPanel(region, DAY_SHIFT)

  expect(panel).toHaveTextContent('Léa Martin')
  expect(
    within(region).getByRole('button', { name: shiftName(DAY_SHIFT), hidden: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(router.state.location.search).toMatchObject({ tab: 'shifts', shiftId: 'day' })
  expect(router.history.length).toBe(historyLength)
})

test('closes the panel on a click outside it, then opens another shift', async () => {
  const { region, router } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] })
  await openPanel(region, DAY_SHIFT)

  const overlay = document.querySelector('[data-slot="sheet-overlay"]')
  expect(overlay).not.toBeNull()
  await userEvent.click(overlay as HTMLElement)

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(router.state.location.search).not.toHaveProperty('shiftId')

  const panel = await openPanel(region, EVENING_SHIFT)
  expect(panel).toHaveTextContent('Hugo Bernard')
  expect(router.state.location.search).toMatchObject({ shiftId: 'evening' })
})

test('forgets the shift when its panel is closed', async () => {
  const { region, router } = await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT] })
  const panel = await openPanel(region, DAY_SHIFT)

  await userEvent.click(within(panel).getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(router.state.location.search).not.toHaveProperty('shiftId')
  expect(within(region).getByRole('button', { name: shiftName(DAY_SHIFT) })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('opens the shift a shared address names', async () => {
  await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] }, '?shiftId=night')

  expect(await screen.findByRole('dialog', { name: shiftName(NIGHT_SHIFT) })).toBeInTheDocument()
})

test('opens no panel when the address names a shift the discharge no longer has', async () => {
  await renderShifts(
    { shifts: [DAY_SHIFT, EVENING_SHIFT] },
    // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
    '?shiftId=removed',
  )

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('forgets the shift the address names when leaving the shifts section', async () => {
  const user = userEvent.setup()
  // A shift no longer on the discharge opens no panel, so the sections stay within reach.
  const { router } = await renderShifts(
    { shifts: [DAY_SHIFT, EVENING_SHIFT] },
    // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
    '?shiftId=removed',
  )

  await user.click(screen.getByRole('tab', { name: /^Product lots/ }))

  await screen.findByRole('region', { name: 'Product lots' })
  expect(router.state.location.search).not.toHaveProperty('shiftId')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('shows when a shift is planned, who is responsible, and how many trucks it has', async () => {
  await renderShifts({ shifts: [DAY_SHIFT, EVENING_SHIFT, NIGHT_SHIFT] }, '?shiftId=evening')

  const panel = await screen.findByRole('dialog', { name: shiftName(EVENING_SHIFT) })
  expect(panel).toHaveTextContent('Active')
  expect(field(panel, 'Planned start')).toHaveTextContent(
    formatDateTime('2026-10-04T14:30:00.000Z'),
  )
  expect(field(panel, 'Planned end')).toHaveTextContent(formatDateTime('2026-10-04T22:00:00.000Z'))
  expect(field(panel, 'Duration')).toHaveTextContent('7 h 30 min')
  expect(field(panel, 'Responsible')).toHaveTextContent('Hugo Bernard')
  expect(within(panel).getByRole('heading', { name: 'Trucks (0)' })).toBeInTheDocument()
  expect(panel).not.toHaveTextContent('No truck selected')
})

test('counts the trucks a finished shift used', async () => {
  await renderShifts({ shifts: [DAY_SHIFT] }, '?shiftId=day')

  const panel = await screen.findByRole('dialog', { name: shiftName(DAY_SHIFT) })
  expect(within(panel).getByRole('heading', { name: 'Trucks (1)' })).toBeInTheDocument()
})

test('flags a planned shift without any truck in its panel', async () => {
  await renderShifts({ shifts: [NIGHT_SHIFT] }, '?shiftId=night')

  const panel = await screen.findByRole('dialog', { name: shiftName(NIGHT_SHIFT) })
  expect(panel).toHaveTextContent('No truck selected')
  expect(within(panel).getByRole('heading', { name: 'Trucks (0)' })).toBeInTheDocument()
})

test('shows the trucks, doors, and weighing areas of a shift with their periods', async () => {
  await renderShifts(
    {
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
    },
    '?shiftId=shift-1',
  )

  const panel = await screen.findByRole('dialog')
  // Each kind counts only what the planned shift still has in effect.
  expect(within(panel).getByRole('heading', { name: 'Trucks (1)' })).toBeInTheDocument()
  expect(within(panel).getByRole('heading', { name: 'Warehouse doors (1)' })).toBeInTheDocument()
  expect(within(panel).getByRole('heading', { name: 'Weighing areas (1)' })).toBeInTheDocument()
  const trucks = within(panel).getByRole('list', { name: 'Trucks' })
  const doors = within(panel).getByRole('list', { name: 'Warehouse doors' })
  const areas = within(panel).getByRole('list', { name: 'Weighing areas' })
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
  await renderShifts({ shifts: [buildShift()] }, '?shiftId=shift-1')

  const panel = await screen.findByRole('dialog')
  expect(within(panel).getAllByText('None selected')).toHaveLength(3)
  expect(within(panel).getByRole('heading', { name: 'Warehouse doors (0)' })).toBeInTheDocument()
  expect(within(panel).getByRole('heading', { name: 'Weighing areas (0)' })).toBeInTheDocument()
  expect(within(panel).queryByRole('list')).not.toBeInTheDocument()
})

test('says so when the discharge has no shift', async () => {
  const { region } = await renderShifts({ shifts: [] })

  expect(within(region).getByText('No shifts planned')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test("shows a closed discharge's shift resources left without an end as ended", async () => {
  await renderShifts(
    {
      status: 'CLOSED',
      shifts: [buildShift({ status: 'COMPLETED', warehouseDoors: [buildDoorPeriod()] })],
    },
    '?shiftId=shift-1',
  )

  const panel = await screen.findByRole('dialog')
  const door = within(within(panel).getByRole('list', { name: 'Warehouse doors' })).getByRole(
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
  renderDischargeTab(closed.id, 'shifts', '?shiftId=shift-1')

  const panel = await screen.findByRole('dialog')
  expect(within(panel).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
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
