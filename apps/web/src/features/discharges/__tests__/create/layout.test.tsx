import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatTonnes } from '@/features/discharges/discharge-detail-view'
import { formatDateTime, fromDateTimeLocalValue } from '@/helpers/dates'

import { ACTIVE_OPERATIONS_LEAD, ELIGIBLE_RESPONSIBLES } from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  continueTo,
  fillLotsStep,
  fillValidPreparation,
  fillVesselStep,
  goToStep,
  mockCreateDischarge,
  mockDischarges,
  mockPreparationOptions,
  openCreationFromList,
} from '../support/test-helpers'

allowFormJourneyTime()

async function reachShiftsStep() {
  await openCreationFromList()
  await fillVesselStep()
  await continueTo('Product lots')
  await fillLotsStep()
  await continueTo('Planned shifts')
}

function arrange() {
  const sent: Array<{ productLots: Array<{ description: string | null }> }> = []
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({ onRequest: (body) => sent.push(body) })

  return { sent }
}

test('opens a lot description only on demand and sends what was typed', async () => {
  const { sent } = arrange()
  await openCreationFromList()
  await fillValidPreparation()
  await goToStep('Product lots')
  const lot = screen.getByRole('group', { name: 'Customer 1' })

  expect(within(lot).queryByRole('textbox', { name: 'Description' })).not.toBeInTheDocument()
  fireEvent.click(within(lot).getByRole('button', { name: 'Add description' }))
  const description = await within(lot).findByRole('textbox', { name: 'Description' })
  expect(description).toHaveFocus()
  change(description, 'Hold 1, starboard')
  await goToStep('Planned shifts')
  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0].productLots[0].description).toBe('Hold 1, starboard')
})

test('starts an added shift when the last one ends, for as long, without a responsible', async () => {
  arrange()
  await reachShiftsStep()
  const first = screen.getByRole('group', { name: 'Shift 1' })
  change(within(first).getByLabelText(/^Planned start/), '2026-10-01T06:00')
  change(within(first).getByLabelText(/^Planned end/), '2026-10-01T14:00')

  expect(within(first).getByText('8 h')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add shift' }))

  const second = await screen.findByRole('group', { name: 'Shift 2' })
  expect(within(second).getByLabelText(/^Planned start/)).toHaveValue('2026-10-01T14:00')
  expect(within(second).getByLabelText(/^Planned end/)).toHaveValue('2026-10-01T22:00')
  expect(within(second).getByRole('combobox', { name: 'Responsible' })).toHaveValue('')
})

test('keeps the totals and the creation in reach in the action bar', async () => {
  const { sent } = arrange()
  await openCreationFromList()
  await fillValidPreparation()
  const bar = screen.getByRole('region', { name: 'Discharge summary' })

  expect(bar).toHaveTextContent(`2 lots · ${formatTonnes('2000.500')} · 2 shifts`)
  expect(bar).toHaveTextContent(
    `${formatDateTime(fromDateTimeLocalValue('2026-10-01T06:00') as string)} → ${formatDateTime(fromDateTimeLocalValue('2026-10-01T22:00') as string)}`,
  )

  await chooseOption(
    screen.getByRole('group', { name: 'Shift 2' }),
    'Responsible',
    `${ELIGIBLE_RESPONSIBLES[1].firstName} ${ELIGIBLE_RESPONSIBLES[1].lastName}`,
  )
  fireEvent.click(within(bar).getByRole('button', { name: 'Create discharge' }))

  await waitFor(() => expect(sent).toHaveLength(1))
})

test('never shows a stale error on a field being typed with a valid value', async () => {
  arrange()
  await reachShiftsStep()
  const shift = screen.getByRole('group', { name: 'Shift 1' })
  // Leaving the start validates the whole form while the end is still empty.
  change(within(shift).getByLabelText(/^Planned start/), '2026-10-01T06:00')

  // Typing the end, without leaving it yet, must not reveal that earlier "required" error: the row
  // would shrink as soon as the field is left, moving whatever the user is about to click.
  fireEvent.change(within(shift).getByLabelText(/^Planned end/), {
    target: { value: '2026-10-01T14:00' },
  })

  await waitFor(() => expect(within(shift).getByText('8 h')).toBeInTheDocument())
  expect(within(shift).queryByText('Planned end is required.')).not.toBeInTheDocument()
})
