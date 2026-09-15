import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { buildDischargeDetail, listedDischarge } from '../support/fixtures'
import { mockDischargeDetail, mockDischarges, renderDischargeDetail } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

test('shows a loading state, never an empty detail, while the discharge is obtained', {
  timeout: 15000,
}, async () => {
  // Well past the router's one-second pending threshold, so the pending state has a wide window to
  // appear even on a loaded machine.
  mockDischargeDetail({ delayMs: 3000 })

  renderDischargeDetail(OCEAN_CEDAR.id)

  expect(
    await screen.findByRole('status', { name: 'Loading discharge' }, { timeout: 5000 }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' }, { timeout: 8000 }),
  ).toBeInTheDocument()
})

test('offers a retry after a failed retrieval and recovers the discharge', async () => {
  const user = userEvent.setup()
  let requests = 0
  mockDischargeDetail({
    failTimes: 1,
    onRequest: () => {
      requests += 1
    },
  })

  renderDischargeDetail(OCEAN_CEDAR.id)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load discharge')

  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('Discharge not found')).not.toBeInTheDocument()
  expect(requests).toBeGreaterThanOrEqual(2)
})

test('tells each empty section apart while the rest of the discharge still shows', async () => {
  const user = userEvent.setup()
  mockDischargeDetail({ details: [buildDischargeDetail(OCEAN_CEDAR)] })

  renderDischargeDetail(OCEAN_CEDAR.id)

  const overview = await screen.findByRole('region', { name: 'Overview' })
  expect(within(overview).getByText('Quai Est')).toBeInTheDocument()

  for (const [tab, region, empty] of [
    [/^Product lots/, 'Product lots', 'No product lots'],
    [/^Truck pool/, 'Truck pool', 'No trucks reserved'],
    [/^Shifts/, 'Shifts', 'No shifts planned'],
  ] as const) {
    await user.click(screen.getByRole('tab', { name: tab }))
    const section = await screen.findByRole('region', { name: region })
    expect(within(section).getByText(empty)).toBeInTheDocument()
  }
})

test('replaces a stale copy with the current discharge on every visit', {
  timeout: 15000,
}, async () => {
  const user = userEvent.setup()
  // Read by reference at every request, so replacing the entry changes what the server answers.
  const details = [buildDischargeDetail(OCEAN_CEDAR, { vesselComment: 'First reading' })]
  mockDischarges()
  mockDischargeDetail({ details })

  renderDischargeDetail(OCEAN_CEDAR.id)
  expect(await screen.findByText('First reading')).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Back to discharges' }))
  const table = await screen.findByRole('table', { name: 'Discharges' }, { timeout: 3000 })

  details[0] = buildDischargeDetail(OCEAN_CEDAR, { vesselComment: 'Second reading' })
  await user.click(within(table).getByRole('link', { name: 'View discharge MV Ocean Cedar' }))

  expect(await screen.findByText('Second reading', {}, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.queryByText('First reading')).not.toBeInTheDocument()
})
