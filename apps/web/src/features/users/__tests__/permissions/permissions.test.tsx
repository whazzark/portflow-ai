import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderApp } from '@/test/render-app'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OBSERVER,
  OPERATIONS_ADMIN,
  OPERATIONS_LEAD,
  ORGANIZATION_ADMIN,
} from '../support/fixtures'
import { mockUsers, mockUsersRefused, renderUsers } from '../support/test-helpers'

test('presents the active collection to an operations admin without any status tab', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const active = await screen.findByRole('table', { name: 'Active users' })

  expect(active).toBeInTheDocument()
  expect(screen.queryByRole('tablist', { name: 'User access status' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

test('counts the active collection for an operations admin', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.getByRole('heading', { name: /Active users/ })).toHaveTextContent('(2)')
})

test('discloses no other access status to an operations admin', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.queryByText(/Pending/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Deactivated/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Cancelled/i)).not.toBeInTheDocument()
})

test.each([
  ['an operations lead', OPERATIONS_LEAD],
  ['an observer', OBSERVER],
])('returns no user information to %s reaching /users directly', async (_label, viewer) => {
  mockUsersRefused(viewer)

  renderUsers()

  expect(await screen.findByText(/Unable to load users/i)).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByText('amelie.bernard@portflow.test')).not.toBeInTheDocument()
})

test.each([
  ['an operations lead', OPERATIONS_LEAD],
  ['an observer', OBSERVER],
])('offers no user administration entry point to %s', async (_label, viewer) => {
  mockUsers(viewer, [])
  renderApp('/')

  await screen.findAllByRole('link', { name: 'Overview' })

  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
})

test.each([
  ['an organization admin', ORGANIZATION_ADMIN],
  ['an operations admin', OPERATIONS_ADMIN],
])('offers the user administration entry point to %s', async (_label, viewer) => {
  mockUsers(viewer, [])
  renderApp('/')

  expect(await screen.findByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users')
})
