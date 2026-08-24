import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_ADMIN,
  BULK_AVAILABLE_TRUCKS,
  BULK_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('offers no selection controls to a non-administrator active role', async () => {
  mockTrucks({ user: ACTIVE_OBSERVER, complete: BULK_TRUCKS, available: BULK_AVAILABLE_TRUCKS })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
})

test('drops the selection from the floating toolbar when leaving the available tab', async () => {
  const user = userEvent.setup()
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Archived/ }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})

test('drops selected trucks that fall outside a new transport-company filter', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  const { router } = renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' }))
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck HH-802-PF' }))
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await router.navigate({
    to: router.state.location.pathname,
    search: (previous: Record<string, unknown>) => ({
      ...previous,
      // GG-701-PF belongs to this company; HH-802-PF does not.
      transportCompanyId: '00000000-0000-4000-8000-000000000001',
    }),
  })

  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'HH-802-PF, Bêta Logistique' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('restores selections from other companies once a transport-company filter is cleared', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  const { router } = renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' }))
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck HH-802-PF' }))
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await router.navigate({
    to: router.state.location.pathname,
    search: (previous: Record<string, unknown>) => ({
      ...previous,
      // Only II-903-PF belongs to this company; GG-701-PF and HH-802-PF do not.
      transportCompanyId: '00000000-0000-4000-8000-000000000003',
    }),
  })

  const filteredList = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(filteredList).getByRole('checkbox', { name: 'Select truck II-903-PF' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await router.navigate({
    to: router.state.location.pathname,
    search: (previous: Record<string, unknown>) => ({
      ...previous,
      transportCompanyId: undefined,
    }),
  })

  await waitFor(() => expect(screen.getByText('3 selected')).toBeInTheDocument())
})

test('keeps a selected truck selected while a search term hides it', async () => {
  const user = userEvent.setup()
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(within(list).getByRole('checkbox', { name: 'Select truck GG-701-PF' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Search trucks' }), 'HH-802-PF')
  expect(
    within(screen.getByRole('list', { name: 'Available trucks' })).queryByRole('button', {
      name: /GG-701-PF/,
    }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})
