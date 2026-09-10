import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_ROLES } from '../support/fixtures'
import { dischargeTab, mockDischarges, renderDischarges } from '../support/test-helpers'

test.each(ACTIVE_ROLES.map((user) => [user.role, user] as const))(
  'shows %s every status of the collection',
  async (_role, user) => {
    mockDischarges({ user })

    renderDischarges()
    const table = await screen.findByRole('table', { name: 'Discharges' })

    expect(within(table).getByText('MV Ocean Cedar')).toBeInTheDocument()
    expect(dischargeTab(/Planned \(2\)/)).toBeInTheDocument()
    expect(dischargeTab(/Active \(1\)/)).toBeInTheDocument()
    expect(dischargeTab(/Closed \(2\)/)).toBeInTheDocument()
  },
)

test('offers no creation or administration action to any role', async () => {
  mockDischarges()

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })

  expect(
    screen.queryByRole('button', {
      name: /^(create|new|edit|archive|reactivate|delete|prepare|confirm)/i,
    }),
  ).not.toBeInTheDocument()
})
