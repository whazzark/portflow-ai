import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { DISCHARGE_DETAIL_TABS } from '@/features/discharges/types'
import {
  ACTIVE_OBSERVER,
  ACTIVE_ROLES,
  buildDischargeDetail,
  buildLot,
  buildShift,
  DISCHARGE_DETAILS,
  listedDischarge,
} from '../support/fixtures'
import {
  mockDischargeDetail,
  openLotMenu,
  renderDischargeDetail,
  renderDischargeTab,
} from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

const ACTION_NAMES =
  /^(add|create|new|edit|remove|prepare|activate|start|confirm|close|assign|release|reassign|archive|delete)/i
const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const LOIRE_STAR = listedDischarge('MV Loire Star', 'CLOSED')

// Every discharge has a lot and a planned shift, so an absent planning action is a decision, not
// an empty section.
const WITH_PLANNING_TARGETS = DISCHARGE_DETAILS.map((detail) =>
  [ATLANTIC_DAWN.id, OCEAN_CEDAR.id, LOIRE_STAR.id].includes(detail.id)
    ? buildDischargeDetail(listedDischarge(detail.vesselName, detail.status), {
        productLots: [buildLot()],
        shifts: [buildShift()],
      })
    : detail,
)

test.each(
  [ATLANTIC_DAWN, OCEAN_CEDAR, LOIRE_STAR].map((listed) => [listed.status, listed] as const),
)('shows an observer a read-only %s discharge', async (_status, listed) => {
  mockDischargeDetail({ user: ACTIVE_OBSERVER, details: WITH_PLANNING_TARGETS })

  // Every section, since each one renders only while its tab is open.
  for (const tab of DISCHARGE_DETAIL_TABS) {
    const view = renderDischargeTab(listed.id, tab)
    await screen.findByRole('heading', { level: 1, name: listed.vesselName })

    expect(screen.queryByRole('button', { name: ACTION_NAMES })).not.toBeInTheDocument()
    view.unmount()
  }
})

test.each(
  ACTIVE_ROLES.filter((user) => user.role !== 'OBSERVER').map((user) => [user.role, user] as const),
)('offers %s the corrections of a planned discharge only', async (_role, user) => {
  mockDischargeDetail({ user, details: WITH_PLANNING_TARGETS })

  const { unmount } = renderDischargeDetail(ATLANTIC_DAWN.id)
  const overview = await screen.findByRole('region', { name: 'Overview' })
  expect(within(overview).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  unmount()

  // The lots live in their own tab, where a lot's menu offers its warehouse door planning.
  const lotsView = renderDischargeTab(ATLANTIC_DAWN.id, 'product-lots')
  const menu = await openLotMenu('Cargill France · Blé tendre')
  expect(within(menu).getByRole('menuitem', { name: 'Assign doors' })).toBeInTheDocument()
  lotsView.unmount()

  for (const listed of [OCEAN_CEDAR, LOIRE_STAR]) {
    for (const tab of DISCHARGE_DETAIL_TABS) {
      const view = renderDischargeTab(listed.id, tab)
      await screen.findByRole('heading', { level: 1, name: listed.vesselName })

      expect(screen.queryByRole('button', { name: ACTION_NAMES })).not.toBeInTheDocument()
      view.unmount()
    }
  }
})

test('sends an unauthenticated visitor to sign in without disclosing the discharge', async () => {
  // No session mocked: the default handlers answer the session lookup as unauthenticated.
  const { router } = renderDischargeDetail(OCEAN_CEDAR.id)

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
  expect(screen.queryByText('MV Ocean Cedar')).not.toBeInTheDocument()
})
