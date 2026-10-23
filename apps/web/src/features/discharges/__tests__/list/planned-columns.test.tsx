import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { DischargeDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'

import { listedDischarge } from '../support/fixtures'
import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const BALTIC_STAR = listedDischarge('MV Baltic Star', 'PLANNED')

async function plannedTable(discharges?: DischargeDto[]) {
  const user = userEvent.setup()
  mockDischarges(discharges ? { discharges } : {})

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Planned/))

  return screen.findByRole('table', { name: 'Discharges' })
}

function rowOf(table: HTMLElement, vesselName: string) {
  return within(table).getByRole('row', { name: new RegExp(vesselName) })
}

test('lists the columns a planned discharge is prepared by', async () => {
  const table = await plannedTable()

  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual([
    'Vessel',
    'Dock',
    'Expected start',
    'Preparation',
    'Lots · tonnage',
    'Customers',
    'Open',
  ])
})

test('shows the expected start, not an actual one', async () => {
  const row = rowOf(await plannedTable(), 'MV Atlantic Dawn')

  expect(within(row).getByText(formatDateTime(ATLANTIC_DAWN.expectedStartAt))).toBeInTheDocument()
})

test('says a discharge whose start check reports no problem is ready', async () => {
  const row = rowOf(await plannedTable(), 'MV Atlantic Dawn')

  expect(within(row).getByText('Ready')).toBeInTheDocument()
  expect(within(row).queryByText(/problem/)).not.toBeInTheDocument()
})

test.each([
  [1, '1 problem'],
  [3, '3 problems'],
])('counts %i start problem(s) as "%s"', async (startProblemCount, label) => {
  const row = rowOf(
    await plannedTable([{ ...ATLANTIC_DAWN, startProblemCount }]),
    'MV Atlantic Dawn',
  )

  expect(within(row).getByText(label)).toBeInTheDocument()
  expect(within(row).queryByText('Ready')).not.toBeInTheDocument()
})

test('tells ready from problems by more than color', async () => {
  const table = await plannedTable([
    { ...ATLANTIC_DAWN, startProblemCount: 0 },
    { ...BALTIC_STAR, startProblemCount: 2 },
  ])

  const ready = within(rowOf(table, 'MV Atlantic Dawn')).getByText('Ready')
  const problems = within(rowOf(table, 'MV Baltic Star')).getByText('2 problems')

  expect(ready.closest('[data-slot=badge]')?.querySelector('svg')).toBeInTheDocument()
  expect(problems.closest('[data-slot=badge]')?.querySelector('svg')).toBeInTheDocument()
  expect(ready.closest('[data-slot=badge]')?.querySelector('svg')?.classList.value).not.toBe(
    problems.closest('[data-slot=badge]')?.querySelector('svg')?.classList.value,
  )
})

test.each([
  [[1], '1 lot · 22,843.000 t'],
  [[1, 2, 3], '3 lots · 22,843.000 t'],
])('counts the lots beside the expected tonnage', async (lots, label) => {
  const productLots = lots.map((index) => ({
    id: `lot-${index}`,
    customerId: `customer-${index}`,
    customerName: `Customer ${index}`,
    productName: 'Blé tendre',
  }))
  const row = rowOf(await plannedTable([{ ...ATLANTIC_DAWN, productLots }]), 'MV Atlantic Dawn')

  expect(within(row).getByText(label)).toBeInTheDocument()
})

test('shows a discharge with no lot yet as zero lots, with no tonnage', async () => {
  const row = rowOf(await plannedTable(), 'MV Baltic Star')

  expect(within(row).getByText('0 lots')).toBeInTheDocument()
  expect(within(row).queryByText(/ t$/)).not.toBeInTheDocument()
  expect(within(row).getByText('2 problems')).toBeInTheDocument()
})
