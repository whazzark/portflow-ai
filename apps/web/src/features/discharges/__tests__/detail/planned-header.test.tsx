import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { DISCHARGE_DETAIL_TABS } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  buildDischargeDetail,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const COMMENT = 'Draught restricted at low tide'

const PREPARED = buildDischargeDetail(ATLANTIC_DAWN, {
  expectedTonnage: '32150.750',
  vesselComment: COMMENT,
  shifts: [
    buildShift({
      id: 'shift-late',
      plannedStartAt: '2026-10-05T06:00:00.000Z',
      plannedEndAt: '2026-10-05T14:00:00.000Z',
    }),
    buildShift({
      id: 'shift-early',
      plannedStartAt: '2026-10-04T06:00:00.000Z',
      plannedEndAt: '2026-10-04T14:00:00.000Z',
    }),
  ],
})

async function headerFacts() {
  await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })

  return screen.getByLabelText('Discharge facts')
}

function fact(facts: HTMLElement, label: string) {
  return within(facts).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement
}

test.each(DISCHARGE_DETAIL_TABS)('keeps the key facts in the header on the %s tab', async (tab) => {
  mockDischargeDetail({ details: [PREPARED] })

  renderDischargeTab(ATLANTIC_DAWN.id, tab)

  const heading = await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })
  expect(heading.parentElement).toHaveTextContent('Planned')
  const facts = await headerFacts()
  expect(
    within(facts)
      .getAllByRole('term')
      .map((term) => term.textContent),
  ).toEqual(['Dock', 'Planned period', 'IMO', 'Expected tonnage'])
  expect(fact(facts, 'Dock')).toHaveTextContent('Quai Nord')
  expect(fact(facts, 'Planned period')).toHaveTextContent(
    formatShiftPeriod({
      plannedStartAt: '2026-10-04T06:00:00.000Z',
      plannedEndAt: '2026-10-05T14:00:00.000Z',
    }),
  )
  expect(fact(facts, 'IMO')).toHaveTextContent('9410001')
  expect(fact(facts, 'Expected tonnage')).toHaveTextContent('32,150.750 t')
})

test('states the expected start and that no shift is planned when there is none', async () => {
  mockDischargeDetail({ details: [buildDischargeDetail(ATLANTIC_DAWN)] })

  renderDischargeTab(ATLANTIC_DAWN.id, 'overview')

  const period = fact(await headerFacts(), 'Planned period')
  expect(period).toHaveTextContent(formatDateTime(ATLANTIC_DAWN.expectedStartAt))
  expect(period).toHaveTextContent(/no shift planned/i)
})

test('shows the vessel comment on the overview only', async () => {
  mockDischargeDetail({ details: [PREPARED] })

  const view = renderDischargeTab(ATLANTIC_DAWN.id, 'overview')
  await headerFacts()
  expect(screen.getByText(COMMENT)).toBeInTheDocument()
  view.unmount()

  for (const tab of DISCHARGE_DETAIL_TABS.filter((candidate) => candidate !== 'overview')) {
    const other = renderDischargeTab(ATLANTIC_DAWN.id, tab)
    await headerFacts()
    expect(screen.queryByText(COMMENT)).not.toBeInTheDocument()
    other.unmount()
  }
})

test('leaves no empty comment behind when the vessel has none', async () => {
  mockDischargeDetail({ details: [buildDischargeDetail(ATLANTIC_DAWN)] })

  renderDischargeTab(ATLANTIC_DAWN.id, 'overview')
  await headerFacts()

  expect(screen.queryByText('Vessel comment')).not.toBeInTheDocument()
})

test('marks an archived dock in the header', async () => {
  mockDischargeDetail({
    details: [
      buildDischargeDetail(ATLANTIC_DAWN, {
        dock: { id: 'dock-nord', name: 'Quai Nord', status: 'ARCHIVED' },
      }),
    ],
  })

  renderDischargeTab(ATLANTIC_DAWN.id, 'overview')

  expect(fact(await headerFacts(), 'Dock')).toHaveTextContent(/archived/i)
})

test('offers Edit and Start to a preparer and neither to an observer', async () => {
  mockDischargeDetail({ user: ACTIVE_OPERATIONS_LEAD, details: [PREPARED] })
  const view = renderDischargeTab(ATLANTIC_DAWN.id, 'overview')
  await headerFacts()
  expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  view.unmount()

  mockDischargeDetail({ user: ACTIVE_OBSERVER, details: [PREPARED] })
  renderDischargeTab(ATLANTIC_DAWN.id, 'overview')
  await headerFacts()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
})

test('restates no header fact in an overview card', async () => {
  mockDischargeDetail({ details: [PREPARED] })

  renderDischargeTab(ATLANTIC_DAWN.id, 'overview')
  await headerFacts()

  expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Details' })).not.toBeInTheDocument()
  expect(screen.getAllByText('9410001')).toHaveLength(1)
})
