import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { renderApp } from '@/test/render-app'
import { DISCHARGES, listedDischarge } from '../support/fixtures'
import {
  dischargeTab,
  mockDischargeDetail,
  mockDischarges,
  renderDischargeDetail,
  renderDischarges,
} from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')
// Cargill's Loire Star, the only closed discharge a "Cargill" search keeps.
// The tests that go list → detail → list make three route loads each, so they get more time than
// the default when the machine is busy.
const CARGILL_LOIRE_STAR = DISCHARGES.find((discharge) => discharge.vesselImo === '9410003')

async function openCargillLoireStarFromTheClosedList() {
  const user = userEvent.setup()
  mockDischarges()
  mockDischargeDetail()

  // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
  const app = renderDischarges('/discharges?status=closed&search=Cargill')
  const table = await screen.findByRole('table', { name: 'Discharges' })
  await user.click(within(table).getByRole('link', { name: 'View discharge MV Loire Star' }))
  await screen.findByRole('heading', { level: 1, name: 'MV Loire Star' })

  return { ...app, user }
}

test('returns to the tab and the search the discharge was opened from', {
  timeout: 15000,
}, async () => {
  const { router, user } = await openCargillLoireStarFromTheClosedList()

  await user.click(screen.getByRole('link', { name: 'Back to discharges' }))

  await screen.findByRole('table', { name: 'Discharges' }, { timeout: 3000 })
  expect(router.state.location.pathname).toBe('/discharges')
  expect(dischargeTab(/Closed/)).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('textbox', { name: 'Search discharges' })).toHaveValue('Cargill')
})

test('returns to the same collection through the breadcrumb', { timeout: 15000 }, async () => {
  const { router, user } = await openCargillLoireStarFromTheClosedList()
  const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })

  await user.click(within(breadcrumb).getByRole('link', { name: 'Discharges' }))

  await screen.findByRole('table', { name: 'Discharges' }, { timeout: 3000 })
  expect(router.state.location.pathname).toBe('/discharges')
  expect(router.state.location.search).toMatchObject({ search: 'Cargill', status: 'closed' })
})

test('carries the open discharge in the address, so a reload shows it again', {
  timeout: 15000,
}, async () => {
  const { router } = await openCargillLoireStarFromTheClosedList()
  const { href, pathname } = router.state.location
  expect(pathname).toBe(`/discharges/${CARGILL_LOIRE_STAR?.id}`)

  // A reload is a fresh app on the same address.
  cleanup()
  mockDischargeDetail()
  const reloaded = renderApp(href)

  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Loire Star' }),
  ).toBeInTheDocument()
  expect(reloaded.router.state.location.search).toMatchObject({
    search: 'Cargill',
    status: 'closed',
  })
})

test('opens a discharge from a bare address and falls back to the active list on the way back', {
  timeout: 15000,
}, async () => {
  const user = userEvent.setup()
  mockDischarges()
  mockDischargeDetail()

  const { router } = renderDischargeDetail(OCEAN_CEDAR.id)
  await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })
  await user.click(screen.getByRole('link', { name: 'Back to discharges' }))

  await screen.findByRole('table', { name: 'Discharges' }, { timeout: 3000 })
  expect(router.state.location.pathname).toBe('/discharges')
  expect(dischargeTab(/Active/)).toHaveAttribute('aria-selected', 'true')
})

test('opens the discharge an address names, whatever list state it also carries', async () => {
  const planned = listedDischarge('MV Baltic Star', 'PLANNED')
  mockDischargeDetail()

  // biome-ignore lint/security/noSecrets: a hand-typed consultation address, not a credential
  renderDischargeDetail(planned.id, '?status=closed&search=zzz')

  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Baltic Star' }),
  ).toBeInTheDocument()
})

test.each([
  ['an unknown discharge', '00000000-0000-4000-8000-000000000999'],
  ['a malformed address', 'nope'],
])('shows %s as not found, with a way back and nothing to retry', async (_case, id) => {
  mockDischargeDetail()

  const { router } = renderDischargeDetail(id)

  expect(await screen.findByText('Discharge not found')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to discharges' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/discharges/${id}`)
})
