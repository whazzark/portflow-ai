import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { DISCHARGE_DETAIL_TABS } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import { ACTIVE_OPERATIONS_LEAD, activeDischargeDetail } from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

function field(region: HTMLElement, label: string) {
  const term = within(region).getByText(label, { selector: 'dt' })

  return term.nextElementSibling as HTMLElement
}

async function findHeaderFacts() {
  const heading = await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })

  return heading.parentElement?.nextElementSibling as HTMLElement
}

test.each(DISCHARGE_DETAIL_TABS)(
  'keeps the dock, the period, the IMO, and the expected tonnage in the header on %s',
  async (tab) => {
    const discharge = activeDischargeDetail()
    mockDischargeDetail({ details: [discharge] })

    renderDischargeTab(discharge.id, tab)

    const facts = await findHeaderFacts()
    expect(facts.parentElement).toHaveTextContent('Active')
    expect(field(facts, 'Dock')).toHaveTextContent('Quai Est')
    expect(field(facts, 'Period')).toHaveTextContent(
      `${formatDateTime(discharge.startedAt)} → ${formatDateTime(discharge.shifts.at(-1)?.plannedEndAt ?? null)}`,
    )
    expect(field(facts, 'IMO')).toHaveTextContent('9410002')
    expect(field(facts, 'Expected tonnage')).toHaveTextContent('16,790.500 t')
  },
)

test('says an absent IMO is not specified', async () => {
  const discharge = activeDischargeDetail({ vesselImo: null })
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  expect(field(await findHeaderFacts(), 'IMO')).toHaveTextContent('Not specified')
})

test('offers neither Edit nor Start on a started discharge, even to a preparer', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ user: ACTIVE_OPERATIONS_LEAD, details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  await findHeaderFacts()
  expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^start/i })).not.toBeInTheDocument()
})

test('shows the vessel comment on the overview only', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  const { unmount } = renderDischargeTab(discharge.id, 'overview')

  await findHeaderFacts()
  expect(screen.getByText('Draught restricted at low tide')).toBeInTheDocument()
  unmount()

  renderDischargeTab(discharge.id, 'product-lots')

  await findHeaderFacts()
  expect(screen.queryByText('Draught restricted at low tide')).not.toBeInTheDocument()
})

test('leaves no empty comment block when the vessel has none', async () => {
  const discharge = activeDischargeDetail({ vesselComment: null })
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  await findHeaderFacts()
  expect(screen.queryByText('Vessel comment')).not.toBeInTheDocument()
})

test('does not repeat the header facts in an overview card', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  await findHeaderFacts()
  expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument()
  expect(screen.getAllByText('Expected tonnage', { selector: 'dt' })).toHaveLength(1)
})
