import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_ROLES, listedDischarge } from '../support/fixtures'
import { mockDischargeDetail, renderDischargeDetail } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

test.each(ACTIVE_ROLES.map((user) => [user.role, user] as const))(
  'shows %s the same read-only detail',
  async (_role, user) => {
    mockDischargeDetail({ user })

    renderDischargeDetail(OCEAN_CEDAR.id)
    await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })

    expect(
      screen.queryByRole('button', {
        name: /^(create|new|edit|prepare|activate|start|confirm|close|assign|release|reassign|archive|delete)/i,
      }),
    ).not.toBeInTheDocument()
  },
)

test('sends an unauthenticated visitor to sign in without disclosing the discharge', async () => {
  // No session mocked: the default handlers answer the session lookup as unauthenticated.
  const { router } = renderDischargeDetail(OCEAN_CEDAR.id)

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
  expect(screen.queryByText('MV Ocean Cedar')).not.toBeInTheDocument()
})
