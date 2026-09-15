import { screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_OBSERVER, ACTIVE_OPERATIONS_LEAD } from '../support/fixtures'
import {
  mockDischarges,
  mockPreparationOptions,
  renderCreateDischarge,
  renderDischarges,
} from '../support/test-helpers'

test('sends an observer back to the list, keeping its status and search', async () => {
  let responsiblesRequests = 0
  mockPreparationOptions({
    user: ACTIVE_OBSERVER,
    onResponsiblesRequest: () => {
      responsiblesRequests += 1
    },
  })
  mockDischarges({ user: ACTIVE_OBSERVER })

  const { router } = renderCreateDischarge('?status=closed&search=cedar')

  await screen.findByRole('table', { name: 'Discharges' })
  await waitFor(() => expect(router.state.location.pathname).toBe('/discharges'))
  expect(router.state.location.search).toMatchObject({ status: 'closed', search: 'cedar' })
  expect(screen.queryByRole('heading', { name: 'New discharge' })).not.toBeInTheDocument()
  expect(responsiblesRequests).toBe(0)
})

test('opens the creation page for an operations lead on its first step', async () => {
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })

  renderCreateDischarge()

  expect(await screen.findByRole('heading', { name: 'New discharge' })).toBeInTheDocument()
  expect(
    screen.getByRole('navigation', { name: 'Discharge preparation steps' }),
  ).toBeInTheDocument()
  expect(await screen.findByRole('textbox', { name: 'Vessel name' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Vessel and dock' })).toBeInTheDocument()
})

test('offers the creation from the empty list of a preparer', async () => {
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD, discharges: [] })

  renderDischarges('/discharges?status=planned')
  const table = await screen.findByRole('table', { name: 'Discharges' })

  expect(within(table).getByRole('link', { name: 'Create discharge' })).toBeInTheDocument()
})
