import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { DISCHARGES, listedDischarge } from '../support/fixtures'
import { mockDischargeDetail, mockDischarges, renderDischarges } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

test('opens a discharge from the link on its vessel name', async () => {
  const user = userEvent.setup()
  mockDischarges()
  mockDischargeDetail()

  const { router } = renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  await user.click(within(table).getByRole('link', { name: 'View discharge MV Ocean Cedar' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/discharges/${OCEAN_CEDAR.id}`)
})

test('opens a discharge from the keyboard', async () => {
  const user = userEvent.setup()
  mockDischarges()
  mockDischargeDetail()

  const { router } = renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  within(table).getByRole('link', { name: 'View discharge MV Ocean Cedar' }).focus()
  await user.keyboard('{Enter}')

  await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })
  expect(router.state.location.pathname).toBe(`/discharges/${OCEAN_CEDAR.id}`)
})

test('opens a discharge from anywhere on its row, carrying the list state along', async () => {
  const user = userEvent.setup()
  mockDischarges()
  mockDischargeDetail()
  // Two closed discharges share the vessel name; the search narrows to Cargill's, IMO 9410003.
  const cargillLoireStar = DISCHARGES.find((discharge) => discharge.vesselImo === '9410003')

  // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
  const { router } = renderDischarges('/discharges?status=closed&search=Cargill')
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /9410003/ })
  await user.click(within(row).getByText('Quai Nord'))

  await screen.findByRole('heading', { level: 1, name: 'MV Loire Star' })
  expect(router.state.location.pathname).toBe(`/discharges/${cargillLoireStar?.id}`)
  expect(router.state.location.search).toMatchObject({ search: 'Cargill', status: 'closed' })
})

test('marks every row as something that opens', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Ocean Cedar/ })

  expect(row).toHaveClass('cursor-pointer')
  expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument()
})
