import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'

import { listedDischarge } from '../support/fixtures'
import { mockDischarges, renderDischarges } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

async function activeRow(discharges?: DischargeDto[]) {
  mockDischarges(discharges ? { discharges } : {})
  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })

  return { table, row: within(table).getByRole('row', { name: /MV Ocean Cedar/ }) }
}

test('lists the columns an active discharge is followed by', async () => {
  const { table } = await activeRow()

  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Vessel', 'Dock', 'Started', 'Active shift', 'Expected tonnage', 'Customers', 'Open'])
})

test('shows when the discharge actually started and how much it expects', async () => {
  const { row } = await activeRow()

  expect(within(row).getByText(formatDateTime(OCEAN_CEDAR.startedAt))).toBeInTheDocument()
  expect(within(row).getByText('8,419.750 t')).toBeInTheDocument()
})

test('names the shift in progress, its period, and its responsible', async () => {
  const { row } = await activeRow()
  const activeShift = OCEAN_CEDAR.activeShift

  expect(within(row).getByText('Shift 2 / 3')).toBeInTheDocument()
  expect(
    within(row).getByText(formatShiftPeriod(activeShift as NonNullable<typeof activeShift>)),
  ).toBeInTheDocument()
  expect(within(row).getByText('Sophie Dubois')).toBeInTheDocument()
  expect(within(row).queryByText(/No shift in progress/)).not.toBeInTheDocument()
})

test('says no shift is in progress between two shifts, and names the next one', async () => {
  const { row } = await activeRow([{ ...OCEAN_CEDAR, activeShift: null }])

  expect(within(row).getByText('No shift in progress')).toBeInTheDocument()
  expect(within(row).getByText('Next: Shift 3 / 3')).toBeInTheDocument()
  expect(within(row).getByText('Thomas Bernard')).toBeInTheDocument()
  expect(within(row).queryByText('Sophie Dubois')).not.toBeInTheDocument()
})

test('says no shift is in progress once none is left to come', async () => {
  const { row } = await activeRow([{ ...OCEAN_CEDAR, activeShift: null, nextShift: null }])

  expect(within(row).getByText('No shift in progress')).toBeInTheDocument()
  expect(within(row).queryByText(/^Next:/)).not.toBeInTheDocument()
})

test('marks an unrecorded start as not specified rather than borrowing the expected start', async () => {
  const { row } = await activeRow([{ ...OCEAN_CEDAR, startedAt: null }])

  expect(within(row).getByText('Not specified')).toBeInTheDocument()
  expect(
    within(row).queryByText(formatDateTime(OCEAN_CEDAR.expectedStartAt)),
  ).not.toBeInTheDocument()
})
