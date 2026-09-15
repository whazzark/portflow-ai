import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_ADMIN,
  ACTIVE_OPERATIONS_LEAD,
  ACTIVE_ORGANIZATION_ADMIN,
  ACTIVE_ROLES,
} from '../support/fixtures'
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

const ACTION_NAMES = /^(create|new|edit|archive|reactivate|delete|prepare|confirm)/i

test('offers an observer no creation or administration action', async () => {
  mockDischarges({ user: ACTIVE_OBSERVER })

  renderDischarges()
  await screen.findByRole('table', { name: 'Discharges' })

  expect(screen.queryByRole('button', { name: ACTION_NAMES })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: ACTION_NAMES })).not.toBeInTheDocument()
})

test.each([ACTIVE_OPERATIONS_LEAD, ACTIVE_OPERATIONS_ADMIN, ACTIVE_ORGANIZATION_ADMIN])(
  'offers an active $role a way to create a discharge that keeps the list state',
  async (user) => {
    mockDischarges({ user })

    renderDischarges('/discharges?status=closed&search=cedar')
    await screen.findByRole('table', { name: 'Discharges' })

    const create = screen.getByRole('link', { name: 'Create discharge' })
    const target = new URL(create.getAttribute('href') ?? '', 'http://localhost')
    expect(target.pathname).toBe('/discharges/new')
    expect(target.searchParams.get('status')).toBe('closed')
    expect(target.searchParams.get('search')).toBe('cedar')
    expect(screen.queryByRole('button', { name: ACTION_NAMES })).not.toBeInTheDocument()
  },
)
