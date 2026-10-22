import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { DISCHARGE_DETAIL_TABS } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import {
  buildDischargeDetail,
  buildDockOccupation,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const NOW = '2026-10-04T10:00:00.000Z'
const FIRST = buildShift({
  id: 'shift-first',
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
})
const SECOND = buildShift({
  id: 'shift-second',
  plannedStartAt: '2026-10-05T06:00:00.000Z',
  plannedEndAt: '2026-10-05T14:00:00.000Z',
})
const HOLDER = buildDockOccupation({
  dischargeId: 'discharge-cedar',
  vesselName: 'MV Ocean Cedar',
  startedAt: '2026-10-03T06:00:00.000Z',
  plannedEndAt: '2026-10-04T10:00:00.000Z',
})
const COMPETITOR = buildDockOccupation({
  dischargeId: 'discharge-loire',
  vesselName: 'MV Loire Star',
  status: 'PLANNED',
  startedAt: null,
  plannedStartAt: '2026-10-05T16:00:00.000Z',
  plannedEndAt: '2026-10-05T17:00:00.000Z',
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderOverview(overrides: Parameters<typeof buildDischargeDetail>[1] = {}) {
  mockDischargeDetail({
    details: [
      buildDischargeDetail(ATLANTIC_DAWN, {
        expectedStartAt: '2026-10-04T06:00:00.000Z',
        shifts: [SECOND, FIRST],
        ...overrides,
      }),
    ],
  })

  return renderDischargeTab(ATLANTIC_DAWN.id, 'overview')
}

const timeline = () => screen.findByRole('region', { name: 'Dock Quai Nord' })

test('opens the overview on the dock timeline', async () => {
  renderOverview()

  const region = await timeline()
  const panel = screen.getByRole('tabpanel')
  expect(within(panel).getAllByRole('region')[0]).toBe(region)
})

test('shows each other discharge on the dock, leading to its record', async () => {
  renderOverview({ dockOccupations: [HOLDER, COMPETITOR] })

  const others = within(await timeline()).getByRole('list', {
    name: 'Other discharges on this dock',
  })
  const [holder, competitor] = within(others).getAllByRole('listitem')

  expect(within(holder).getByRole('link', { name: 'MV Ocean Cedar' })).toHaveAttribute(
    'href',
    expect.stringMatching(/^\/discharges\/discharge-cedar(\?|$)/),
  )
  expect(holder).toHaveTextContent('Active')
  expect(holder).toHaveTextContent(
    formatShiftPeriod({ plannedStartAt: HOLDER.startedAt, plannedEndAt: HOLDER.plannedEndAt }),
  )
  expect(holder).toHaveTextContent('Overlaps this plan')
  expect(within(competitor).getByRole('link', { name: 'MV Loire Star' })).toBeInTheDocument()
  expect(competitor).toHaveTextContent('Planned')
  expect(competitor).not.toHaveTextContent('Overlaps this plan')
})

test('draws an active discharge with no later end as continuing', async () => {
  renderOverview({ dockOccupations: [{ ...HOLDER, plannedEndAt: null }] })

  expect(await timeline()).toHaveTextContent(
    `Since ${formatDateTime(HOLDER.startedAt)} · continues`,
  )
})

test('places now and the expected start, and says when now lies outside the period', async () => {
  const view = renderOverview()

  const events = within(await timeline()).getByRole('list', { name: 'This discharge on the dock' })
  expect(events).toHaveTextContent(`Now, ${formatDateTime(NOW)}`)
  expect(events).toHaveTextContent(`Expected start, ${formatDateTime('2026-10-04T06:00:00.000Z')}`)
  view.unmount()

  vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'))
  renderOverview()
  expect(await timeline()).toHaveTextContent('Now is before this period.')
})

test('lists the shifts in order with the gap between them', async () => {
  renderOverview()

  const events = within(await timeline()).getByRole('list', { name: 'This discharge on the dock' })
  expect(
    within(events)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    `Now, ${formatDateTime(NOW)}`,
    `Expected start, ${formatDateTime('2026-10-04T06:00:00.000Z')}`,
    `Shift ${formatShiftPeriod(FIRST)}`,
    'Gap of 16 h before the next shift',
    `Shift ${formatShiftPeriod(SECOND)}`,
  ])
})

test('says the dock is free when no other discharge is on it', async () => {
  renderOverview()

  expect(await timeline()).toHaveTextContent('The dock is free over this period.')
})

test('says no shift is planned, keeping the markers and the other discharges', async () => {
  renderOverview({ shifts: [], dockOccupations: [HOLDER] })

  const region = await timeline()
  expect(region).toHaveTextContent('No shift planned')
  expect(region).toHaveTextContent(`Expected start, ${formatDateTime('2026-10-04T06:00:00.000Z')}`)
  expect(within(region).getByRole('link', { name: 'MV Ocean Cedar' })).toBeInTheDocument()
})

test.each(DISCHARGE_DETAIL_TABS.filter((tab) => tab !== 'overview'))(
  'leaves the timeline out of the %s tab',
  async (tab) => {
    mockDischargeDetail({
      details: [
        buildDischargeDetail(ATLANTIC_DAWN, { shifts: [FIRST], dockOccupations: [HOLDER] }),
      ],
    })

    renderDischargeTab(ATLANTIC_DAWN.id, tab)
    await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })
    await screen.findByRole('tabpanel')

    expect(screen.queryByRole('region', { name: 'Dock Quai Nord' })).not.toBeInTheDocument()
  },
)
