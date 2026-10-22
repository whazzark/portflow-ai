import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { ACTIVE_OBSERVER, ACTIVE_ROLES, activeDischargeDetail } from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

const PREPARERS = ACTIVE_ROLES.filter((user) => user.role !== ACTIVE_OBSERVER.role)

/** Every button and link a section offers, apart from opening a shift from the calendar. */
function actionsIn(region: HTMLElement) {
  return within(region)
    .queryAllByRole('button')
    .map((button) => button.textContent?.trim() ?? '')
    .filter(Boolean)
}

test.each(ACTIVE_ROLES.map((user) => [user.role, user] as const))(
  'offers %s no correction of the product lots or the truck pool once the discharge has started',
  async (_, user) => {
    const discharge = activeDischargeDetail()
    mockDischargeDetail({ user, details: [discharge] })

    const lots = renderDischargeTab(discharge.id, 'product-lots')
    const lotsRegion = await screen.findByRole('region', { name: 'Product lots' })
    expect(actionsIn(lotsRegion)).toEqual([])
    lots.unmount()

    renderDischargeTab(discharge.id, 'truck-pool')
    const poolRegion = await screen.findByRole('region', { name: 'Truck pool' })
    expect(
      actionsIn(poolRegion).filter((name) => /add|withdraw|reserve|release/i.test(name)),
    ).toEqual([])
    expect(within(poolRegion).queryByRole('checkbox')).not.toBeInTheDocument()
  },
)

test.each(PREPARERS.map((user) => [user.role, user] as const))(
  'offers %s to add a shift, and nothing else, once the discharge has started',
  async (_, user) => {
    const discharge = activeDischargeDetail()
    mockDischargeDetail({ user, details: [discharge] })

    const section = renderDischargeTab(discharge.id, 'shifts')
    const shifts = await screen.findByRole('region', { name: 'Shifts' })
    expect(within(shifts).getByRole('button', { name: 'Add shift' })).toBeInTheDocument()
    section.unmount()

    // A planned shift of a started discharge is not corrected from its panel.
    renderDischargeTab(discharge.id, 'shifts', '?shiftId=shift-7')
    const panel = await screen.findByRole('dialog', {
      name: `Shift ${formatShiftPeriod(discharge.shifts[6])}`,
    })
    expect(within(panel).queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument()
  },
)

test('offers an observer no way to add a shift', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ user: ACTIVE_OBSERVER, details: [discharge] })

  renderDischargeTab(discharge.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  expect(within(shifts).queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('highlights the active shift in the shifts calendar', async () => {
  const discharge = activeDischargeDetail()
  mockDischargeDetail({ details: [discharge] })

  renderDischargeTab(discharge.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  const active = shifts.querySelector('[data-shift-id="shift-6"]') as HTMLElement
  expect(active).not.toBeNull()
  expect(active).toHaveTextContent('Active')
  expect(active.className).toMatch(/border-primary/)
  const planned = shifts.querySelector('[data-shift-id="shift-7"]') as HTMLElement
  expect(planned).not.toHaveTextContent('Active')
  expect(planned.className).not.toMatch(/border-primary/)
})
