import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { DischargeDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'

import { DISCHARGES } from '../support/fixtures'
import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

const CARGILL_LOIRE_STAR = DISCHARGES.find(
  (discharge) => discharge.vesselImo === '9410003',
) as DischargeDto

async function closedTable(discharges?: DischargeDto[]) {
  const user = userEvent.setup()
  mockDischarges(discharges ? { discharges } : {})

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })
  await user.click(dischargeTab(/Closed/))

  return screen.findByRole('table', { name: 'Discharges' })
}

test('lists the columns a closed discharge is remembered by', async () => {
  const table = await closedTable()

  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Vessel', 'Dock', 'Started', 'Closed', 'Expected tonnage', 'Customers', 'Open'])
})

test('shows when it started and how much it expected', async () => {
  const table = await closedTable()
  const row = within(table).getByRole('row', { name: /9410003/ })

  expect(within(row).getByText(formatDateTime(CARGILL_LOIRE_STAR.startedAt))).toBeInTheDocument()
  expect(within(row).getByText('6,100.500 t')).toBeInTheDocument()
})

// No closure time is recorded until Discharge Closure (#98) records one, so the cell never
// fabricates one from the last shift or anything else.
test('marks every closure time as not recorded', async () => {
  const table = await closedTable()

  expect(within(table).getAllByText('Closure time not recorded')).toHaveLength(2)
})

test('marks an unrecorded start as not specified', async () => {
  const table = await closedTable([{ ...CARGILL_LOIRE_STAR, startedAt: null }])
  const row = within(table).getByRole('row', { name: /9410003/ })

  expect(within(row).getByText('Not specified')).toBeInTheDocument()
})
