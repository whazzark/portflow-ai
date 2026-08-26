import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

test('renders users through access status tabs with active selected by default', async () => {
  mockUsers()

  const { router } = renderUsers()
  const active = await screen.findByRole('table', { name: 'Active users' })

  expect(within(active).getByText('amelie.bernard@portflow.test')).toBeInTheDocument()
  expect(within(active).getByText('bruno.costa@portflow.test')).toBeInTheDocument()
  expect(within(active).queryByText('chloe.durand@portflow.test')).not.toBeInTheDocument()
  expect(within(active).queryByText('david.evrard@portflow.test')).not.toBeInTheDocument()
  expect(within(active).queryByText('elodie.fabre@portflow.test')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Active \(2\)/ })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tablist', { name: 'User access status' })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ status: 'active' })
})

test('counts each access status view from the users it represents', async () => {
  mockUsers()

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.getByRole('tab', { name: /Active \(2\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Pending \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Deactivated \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Cancelled \(1\)/ })).toBeInTheDocument()
})

test('identifies each user without opening them', async () => {
  mockUsers()

  renderUsers()
  const active = await screen.findByRole('table', { name: 'Active users' })
  const row = within(active).getByRole('row', { name: /Amélie Bernard/ })

  expect(within(row).getByText('Amélie Bernard')).toBeInTheDocument()
  expect(within(row).getByText('amelie.bernard@portflow.test')).toBeInTheDocument()
  expect(within(row).getByText('Organization admin')).toBeInTheDocument()
  // The access status belongs to the selected view, so the row does not repeat it.
  expect(within(row).queryByText('Active')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Active \(2\)/ })).toHaveAttribute('aria-selected', 'true')
})

test('switches access status views without showing a user of the previous view', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await screen.findByRole('table', { name: 'Active users' })
  await user.click(screen.getByRole('tab', { name: /Pending \(1\)/ }))

  const pending = await screen.findByRole('table', { name: 'Pending users' })

  expect(within(pending).getByText('chloe.durand@portflow.test')).toBeInTheDocument()
  expect(screen.queryByText('amelie.bernard@portflow.test')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ status: 'pending' })
})

test('shows a status-specific empty state and keeps the other views reachable', async () => {
  const user = userEvent.setup()
  mockUsers(
    undefined,
    USERS.filter((entry) => entry.accessStatus !== 'CANCELLED'),
  )

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })
  await user.click(screen.getByRole('tab', { name: /Cancelled \(0\)/ }))

  const cancelled = await screen.findByRole('table', { name: 'Cancelled users' })
  expect(within(cancelled).getByText('No cancelled users')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Active \(2\)/ }))

  expect(await screen.findByRole('table', { name: 'Active users' })).toBeInTheDocument()
})

test('restores the selected access status view from the initial URL', async () => {
  mockUsers()

  const { router } = renderUsers('/users?status=deactivated')

  expect(await screen.findByRole('table', { name: 'Deactivated users' })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ status: 'deactivated' })
})
