import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  ACTIVE_OBSERVER,
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const PERIOD = {
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
}
const ALL_GAPS = [
  'NO_USABLE_TRUCK',
  'NO_USABLE_WAREHOUSE_DOOR',
  'NO_USABLE_WEIGHING_AREA',
  'RESPONSIBLE_NOT_ELIGIBLE',
] as const

function planned(
  readinessGaps: DischargeDetailDto['shifts'][number]['readinessGaps'],
  overrides: Partial<DischargeDetailDto> = {},
) {
  return buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
    truckPool: [buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' })],
    shifts: [buildShift({ id: 'shift-1', ...PERIOD, readinessGaps })],
    ...overrides,
  })
}

async function openPanel() {
  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  fireEvent.click(
    await within(shifts).findByRole('button', { name: `Shift ${formatShiftPeriod(PERIOD)}` }),
  )

  return screen.findByRole('dialog', { name: `Shift ${formatShiftPeriod(PERIOD)}` })
}

const readiness = (panel: HTMLElement) => within(panel).getByRole('region', { name: 'Readiness' })

test('states that nothing is missing on a prepared shift', async () => {
  mockTruckPlanning({ detail: planned([]) })
  renderDischargeTab(planned([]).id, 'shifts')
  const panel = await openPanel()

  expect(readiness(panel)).toHaveTextContent(
    'Nothing missing among trucks, warehouse doors, weighing areas, and responsible.',
  )
})

test('lists every gap in order, never as a verdict on starting', async () => {
  const detail = planned([...ALL_GAPS])
  mockTruckPlanning({ detail })
  renderDischargeTab(detail.id, 'shifts')
  const panel = await openPanel()

  const items = within(within(panel).getByRole('list', { name: 'Readiness' })).getAllByRole(
    'listitem',
  )
  expect(items.map((item) => item.textContent)).toEqual([
    'No usable truck',
    'No usable warehouse door',
    'No usable weighing area',
    'Responsible is no longer eligible',
  ])
  expect(panel).not.toHaveTextContent(/\bready\b|can start/i)
})

test('leaves the correction to the panel footer, and the pool only when it holds no truck', async () => {
  const detail = planned(['NO_USABLE_TRUCK'])
  mockTruckPlanning({ detail })
  renderDischargeTab(detail.id, 'shifts')
  const panel = await openPanel()

  expect(within(readiness(panel)).queryByRole('button')).not.toBeInTheDocument()
  expect(within(readiness(panel)).queryByRole('link')).not.toBeInTheDocument()
  expect(within(panel).getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
})

test('points to the truck pool when the discharge holds no truck', async () => {
  const empty = planned(['NO_USABLE_TRUCK'], { truckPool: [] })
  mockTruckPlanning({ detail: empty })
  renderDischargeTab(empty.id, 'shifts')
  const panel = await openPanel()

  fireEvent.click(within(readiness(panel)).getByRole('link', { name: 'Go to truck pool' }))

  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
})

test('shows the gaps without any action to an observer', async () => {
  const detail = planned([...ALL_GAPS], { truckPool: [] })
  mockTruckPlanning({ user: ACTIVE_OBSERVER, detail })
  renderDischargeTab(detail.id, 'shifts')
  const panel = await openPanel()

  expect(readiness(panel)).toHaveTextContent('No usable truck')
  expect(within(readiness(panel)).queryByRole('button')).not.toBeInTheDocument()
  expect(within(readiness(panel)).queryByRole('link')).not.toBeInTheDocument()
})

test('shows the gaps of an active discharge’s planned shift without any action', async () => {
  const detail = buildDischargeDetail(listedDischarge('MV Ocean Cedar', 'ACTIVE'), {
    truckPool: [],
    shifts: [buildShift({ id: 'shift-1', ...PERIOD, readinessGaps: ['NO_USABLE_TRUCK'] })],
  })
  mockTruckPlanning({ detail })
  renderDischargeTab(detail.id, 'shifts')
  const panel = await openPanel()

  expect(readiness(panel)).toHaveTextContent('No usable truck')
  expect(within(readiness(panel)).queryByRole('button')).not.toBeInTheDocument()
  expect(within(readiness(panel)).queryByRole('link')).not.toBeInTheDocument()
})

test('states no readiness for a started shift', async () => {
  const detail = buildDischargeDetail(listedDischarge('MV Ocean Cedar', 'ACTIVE'), {
    shifts: [buildShift({ id: 'shift-1', status: 'ACTIVE', ...PERIOD })],
  })
  mockTruckPlanning({ detail })
  renderDischargeTab(detail.id, 'shifts')
  const panel = await openPanel()

  expect(within(panel).queryByRole('region', { name: 'Readiness' })).not.toBeInTheDocument()
})

test('updates the gaps once a correction fills them, without a reload', async () => {
  const detail = planned(['NO_USABLE_WEIGHING_AREA'])
  const state = mockTruckPlanning({
    detail,
    respondToShift: () => {
      const corrected = planned([])
      state.current = corrected

      return { status: 200, body: { data: corrected } }
    },
  })
  renderDischargeTab(detail.id, 'shifts')
  const panel = await openPanel()

  fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }))
  const sheet = await screen.findByRole('dialog', { name: 'Edit shift' })
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select North scale' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  const details = await screen.findByRole('dialog', { name: `Shift ${formatShiftPeriod(PERIOD)}` })
  await waitFor(() =>
    expect(within(details).getByRole('region', { name: 'Readiness' })).toHaveTextContent(
      'Nothing missing',
    ),
  )
})
