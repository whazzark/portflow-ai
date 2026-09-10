import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_ROLES } from '@/features/discharges/__tests__/support/fixtures'
import { mockDischarges } from '@/features/discharges/__tests__/support/test-helpers'
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
