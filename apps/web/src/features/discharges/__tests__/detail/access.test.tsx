import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { DISCHARGE_DETAIL_TABS } from '@/features/discharges/types'
import { ACTIVE_OBSERVER, ACTIVE_ROLES, listedDischarge } from '../support/fixtures'
import {
  mockDischargeDetail,
  renderDischargeDetail,
  renderDischargeTab,
} from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

const ACTION_NAMES =
  /^(add|create|new|edit|remove|prepare|activate|start|confirm|close|assign|release|reassign|archive|delete)/i
const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const LOIRE_STAR = listedDischarge('MV Loire Star', 'CLOSED')

test.each(
  [ATLANTIC_DAWN, OCEAN_CEDAR, LOIRE_STAR].map((listed) => [listed.status, listed] as const),
)('shows an observer a read-only %s discharge', async (_status, listed) => {
  mockDischargeDetail({ user: ACTIVE_OBSERVER })

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
  mockDischargeDetail({ user })

  const { unmount } = renderDischargeDetail(ATLANTIC_DAWN.id)
  const overview = await screen.findByRole('region', { name: 'Overview' })
  expect(within(overview).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  unmount()

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
