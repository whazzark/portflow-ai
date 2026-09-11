import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_ROLES, DISCHARGE_DETAILS } from '@/features/discharges/__tests__/support/fixtures'
import {
  mockDischargeDetail,
  mockDischarges,
} from '@/features/discharges/__tests__/support/test-helpers'
import { renderApp } from '@/test/render-app'

test.each(ACTIVE_ROLES.map((user) => [user.role, user] as const))(
  'links %s users to the discharges workbench',
  async (_role, user) => {
    mockDischarges({ user })
    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Discharges' })).toHaveAttribute(
      'href',
      '/discharges',
    )
  },
)

test('keeps the discharges entry current while one discharge is open', async () => {
  const [discharge] = DISCHARGE_DETAILS
  mockDischargeDetail()
  renderApp(`/discharges/${discharge.id}`)

  await screen.findByRole('heading', { level: 1, name: discharge.vesselName })
  const sidebar = screen.getByRole('navigation', { name: 'Primary' })

  expect(within(sidebar).getByRole('link', { name: 'Discharges' })).toHaveAttribute('data-active')
})

test('marks the discharges entry current on the list itself', async () => {
  mockDischarges()
  renderApp('/discharges')

  await screen.findByRole('table', { name: 'Discharges' })
  const sidebar = screen.getByRole('navigation', { name: 'Primary' })

  expect(within(sidebar).getByRole('link', { name: 'Discharges' })).toHaveAttribute('data-active')
})
