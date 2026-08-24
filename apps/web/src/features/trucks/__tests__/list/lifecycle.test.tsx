import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_ADMIN, TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('shows available trucks and their companies to every active role', async () => {
  mockTrucks()

  renderTrucks()
  const available = await screen.findByRole('list', { name: 'Available trucks' })

  expect(within(available).getByText('AA-101-PF')).toBeInTheDocument()
  expect(within(available).getByText('Atlantic Transport')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Available \(2\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.queryByRole('tab', { name: /Archived/ })).not.toBeInTheDocument()
})

test('shows distinct archived rows and independent company status to administrators', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))

  const archived = await screen.findByRole('list', { name: 'Archived trucks' })
  expect(within(archived).getByText('CC-303-PF')).toBeInTheDocument()
  expect(within(archived).getByText('Coastal Haulage')).toBeInTheDocument()
  expect(screen.getByText('Archived company')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', {
      name: /^(edit|archive|reactivate|delete|assign|import|sync)/i,
    }),
  ).not.toBeInTheDocument()
})

test('keeps empty permitted lifecycle collections explicit and selectable', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN, complete: [] })

  renderTrucks()
  expect(await screen.findByText('No available trucks')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Archived \(0\)/ }))
  expect(await screen.findByText('No archived trucks')).toBeInTheDocument()
})

test('does not derive non-admin visibility from a complete payload', async () => {
  mockTrucks({ available: TRUCKS.filter((truck) => truck.status === 'AVAILABLE') })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  expect(screen.queryByText('CC-303-PF')).not.toBeInTheDocument()
  expect(screen.queryByText('Coastal Haulage')).not.toBeInTheDocument()
})
