import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { LOT_GONE_MESSAGE } from '@/features/discharges/ui/detail/product-lot-sheet'
import { PLANNING_CONFLICT_MESSAGE } from '@/features/discharges/ui/planning/planning-refusals'
import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargePlanning,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [
    buildLot({ id: 'lot-wheat', productName: 'Blé tendre', doorAssignments: [buildDoorPeriod()] }),
  ],
  shifts: [buildShift({ id: 'shift-first' })],
})

const stateRefusal = (status: number, code: string) => ({
  status,
  body: { error: { code, message: code } },
})

async function saveLotDoors() {
  const menu = await openLotMenu('Cargill France · Blé tendre')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Assign doors' }))
  const sheet = await screen.findByRole('dialog', { name: 'Warehouse doors' })
  fireEvent.click(
    await within(sheet).findByRole('button', { name: 'Add', description: /^Door B1/ }),
  )
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
}

test.each([
  ['E_DISCHARGE_NOT_PLANNED', 409, STARTED_REFUSAL_MESSAGE],
  ['E_PRODUCT_LOT_NOT_FOUND', 404, LOT_GONE_MESSAGE],
  ['E_DISCHARGE_PLANNING_CONFLICT', 409, PLANNING_CONFLICT_MESSAGE],
])('closes the lot sheet and refreshes the detail on %s', async (code, status, message) => {
  const state = mockDischargePlanning({
    detail: PLANNED,
    respondToLotDoors: () => stateRefusal(status, code),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  await saveLotDoors()

  expect(await screen.findByText(message)).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Warehouse doors' })).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(1))
})
