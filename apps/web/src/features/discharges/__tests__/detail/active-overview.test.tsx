import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { formatShiftDuration, formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { formatDateTime } from '@/helpers/dates'
import { ACTIVE_OBSERVER, ACTIVE_OPERATIONS_LEAD, activeDischargeDetail } from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

function betweenShifts() {
  const discharge = activeDischargeDetail()

  return {
    ...discharge,
    shifts: discharge.shifts.map((shift) =>
      shift.status === 'ACTIVE' ? { ...shift, status: 'COMPLETED' as const } : shift,
    ),
  }
}

test('leads the overview with the active shift, who is responsible, and what it uses now', async () => {
  const discharge = activeDischargeDetail()
  const active = discharge.shifts[5]
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(screen.getAllByRole('region')[0]).toBe(card)
  expect(within(card).getByText('Active')).toBeInTheDocument()
  expect(card).toHaveTextContent(
    `Shift 6 of 14 · ${formatShiftPeriod(active)} · ${formatShiftDuration(active)}`,
  )
  expect(card).toHaveTextContent(`Started ${formatDateTime(active.actualStartAt)}`)
  expect(card).toHaveTextContent('ResponsibleClaire Martin')
  expect(within(card).getByRole('list', { name: 'Trucks (2)' })).toHaveTextContent(
    'PN-552-PFQV-569-PF',
  )
  expect(within(card).getByRole('list', { name: 'Warehouse doors (2)' })).toHaveTextContent(
    'Porte DouanePorte Nord',
  )
  expect(within(card).getByRole('list', { name: 'Weighing areas (1)' })).toHaveTextContent(
    'Pont-bascule Nord',
  )
})

test('names the next shift with its responsible and what it will use', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent(
    `Next: ${formatShiftPeriod(discharge.shifts[6])} · Sophie Dubois · 6 trucks, 1 door, 1 weighing area`,
  )
})

test('says no further shift is planned after the last one', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [{ ...discharge, shifts: discharge.shifts.slice(0, 6) }] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent('No further shift planned')
  expect(card).not.toHaveTextContent('Next:')
})

test('between two shifts, says no shift is active and names the last and the next ones', async () => {
  const discharge = betweenShifts()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent('No shift is active')
  expect(card).toHaveTextContent(`Last: ${formatShiftPeriod(discharge.shifts[5])}`)
  expect(card).toHaveTextContent(`Next: ${formatShiftPeriod(discharge.shifts[6])}`)
  expect(within(card).queryByText('Responsible')).not.toBeInTheDocument()
})

test('offers a preparer to add a shift once nothing is planned any more, and nobody else', async () => {
  const discharge = betweenShifts()
  const finished = { ...discharge, shifts: discharge.shifts.slice(0, 6) }
  mockDischargeDetail({ user: ACTIVE_OPERATIONS_LEAD, details: [finished] })

  const view = renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(card).toHaveTextContent('No further shift planned')
  await userEvent.setup().click(within(card).getByRole('button', { name: 'Add shift' }))
  expect(await screen.findByRole('dialog', { name: 'Add shift' })).toBeInTheDocument()
  view.unmount()

  mockDischargeDetail({ user: ACTIVE_OBSERVER, details: [finished] })
  renderDischargeTab(discharge.id, 'overview')

  const observed = await screen.findByRole('region', { name: 'Current shift' })
  expect(within(observed).queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('keeps an archived door readable on the card and says it is archived', async () => {
  const discharge = activeDischargeDetail()
  const active = discharge.shifts[5]
  const archived = {
    ...active,
    warehouseDoors: active.warehouseDoors.map((membership, index) =>
      index === 0
        ? {
            ...membership,
            warehouseDoor: { ...membership.warehouseDoor, status: 'ARCHIVED' as const },
          }
        : membership,
    ),
  }
  mockDischargeDetail({
    details: [
      {
        ...discharge,
        shifts: discharge.shifts.map((shift) => (shift === active ? archived : shift)),
      },
    ],
  })

  renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  expect(within(card).getByRole('list', { name: 'Warehouse doors (2)' })).toHaveTextContent(
    'Porte DouaneArchived',
  )
})

test('opens the active shift in the shifts section', async () => {
  const discharge = activeDischargeDetail()
  const active = discharge.shifts[5]
  mockDischargeDetail({ details: [discharge] })

  const { router } = renderDischargeTab(discharge.id, 'overview')

  const card = await screen.findByRole('region', { name: 'Current shift' })
  await userEvent.setup().click(within(card).getByRole('link', { name: 'Open in Shifts' }))

  expect(
    await screen.findByRole('dialog', { name: `Shift ${formatShiftPeriod(active)}` }),
  ).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ tab: 'shifts', shiftId: 'shift-6' })
})
