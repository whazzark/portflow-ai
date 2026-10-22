import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD } from '@/features/trucks/__tests__/support/fixtures'
import {
  expectListed,
  findFleetTable,
  fleetPath,
  fleetTable,
  groupHeader,
  listedRegistrations,
  mockFleet,
  renderFleet,
  statusPill,
  truckRow,
} from './support/fleet-test-helpers'

test('shows the fleet without any creation, editing or lifecycle control', async () => {
  let completeRequests = 0
  mockFleet({
    user: ACTIVE_OPERATIONS_LEAD,
    onCompleteTrucksRequest: () => {
      completeRequests += 1
    },
  })
  renderFleet()
  await findFleetTable()

  expect(listedRegistrations()).toHaveLength(7)
  expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  expect(within(fleetTable()).queryByRole('button', { name: /^Actions for / })).toBeNull()
  expect(within(fleetTable()).queryByRole('button', { name: /to service$/ })).toBeNull()
  expect(within(fleetTable()).queryByRole('button', { name: /^Reactivate/ })).toBeNull()
  // Filters, search and collapse stay available.
  expect(screen.getByRole('textbox', { name: 'Search transport resources' })).toBeEnabled()
  expect(within(fleetTable()).getByRole('button', { name: 'Collapse Bretagne Vrac' })).toBeEnabled()
  // The complete truck collection, with archived trucks and actors, is administrators' only.
  expect(completeRequests).toBe(0)
})

test('shows the suspension comment and date without who suspended the truck', async () => {
  mockFleet({ user: ACTIVE_OPERATIONS_LEAD })
  renderFleet()
  await findFleetTable()

  const suspended = within(truckRow('GH-012-JK'))
  expect(suspended.getByText('Brake inspection after a warning light')).toBeInTheDocument()
  expect(suspended.getByText('22/09/2026', { exact: false })).toBeInTheDocument()
  expect(suspended.queryByText(/Thomas Bernard/)).not.toBeInTheDocument()
})

test('lists archived companies only under the Archived filter', async () => {
  const user = userEvent.setup()
  mockFleet({ user: ACTIVE_OPERATIONS_LEAD })
  renderFleet()
  await findFleetTable()

  expect(statusPill('Archived')).toHaveTextContent('1')

  await user.click(statusPill('Archived'))
  await user.click(statusPill('Available'))
  await user.click(statusPill('Suspended'))

  await expectListed([])
  expect(groupHeader('Transports Morvan')).toBeInTheDocument()
  // Company archive context stays readable to every active user, as before.
  expect(
    within(groupHeader('Transports Morvan')).getByText('Thomas Bernard, 02/07/2026', {
      exact: false,
    }),
  ).toBeInTheDocument()
  expect(
    screen.queryByText('Reactivate the company first to reactivate one of its trucks.'),
  ).not.toBeInTheDocument()
})

test('opens no creation or editing form from a hand-typed address', async () => {
  mockFleet({ user: ACTIVE_OPERATIONS_LEAD })
  const { router } = renderFleet(fleetPath({ truckMode: 'create', companyDetailsMode: 'edit' }))
  await findFleetTable()

  await expect
    .poll(() => router.state.location.search)
    .toMatchObject({
      truckMode: 'view',
      companyDetailsMode: 'view',
    })
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
