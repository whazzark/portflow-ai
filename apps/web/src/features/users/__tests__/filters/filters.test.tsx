import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

const searchBox = () => screen.getByRole('textbox', { name: 'Search users' })

// A highlighted match splits the cell text across elements, so rows are matched on their
// accessible name, which joins the fragments back together.
const rowFor = (table: HTMLElement, email: string) =>
  within(table).queryByRole('row', { name: new RegExp(email.replace(/[.@]/g, '\\$&')) })

test.each([
  ['a first name fragment', 'mél'],
  ['a last name fragment', 'ernar'],
  ['an email fragment', 'amelie.bern'],
  ['an upper-case fragment', 'AMELIE'],
])('narrows the visible view by %s', async (_label, fragment) => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await screen.findByRole('table', { name: 'Active users' })
  await user.type(searchBox(), fragment)

  const active = screen.getByRole('table', { name: 'Active users' })

  expect(rowFor(active, 'amelie.bernard@portflow.test')).toBeInTheDocument()
  expect(rowFor(active, 'bruno.costa@portflow.test')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ search: fragment })
})

test('combines the search with the role filter inside the selected view', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  await user.click(screen.getByRole('combobox', { name: 'Filter by role' }))
  await user.click(await screen.findByRole('option', { name: 'Operations lead' }))

  expect(screen.getByRole('combobox', { name: 'Filter by role' })).toHaveTextContent(
    'Operations lead',
  )

  const active = screen.getByRole('table', { name: 'Active users' })

  expect(rowFor(active, 'bruno.costa@portflow.test')).toBeInTheDocument()
  expect(rowFor(active, 'amelie.bernard@portflow.test')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ role: 'OPERATIONS_LEAD' })

  await user.type(searchBox(), 'amelie')

  expect(within(active).getByText('No matching users')).toBeInTheDocument()
})

test('distinguishes a no-match result from a status view holding no user', async () => {
  const user = userEvent.setup()
  mockUsers(
    undefined,
    USERS.filter((entry) => entry.accessStatus !== 'CANCELLED'),
  )

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })
  await user.type(searchBox(), 'zzz')

  expect(
    within(screen.getByRole('table', { name: 'Active users' })).getByText('No matching users'),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Cancelled \(0\)/ }))

  const cancelled = await screen.findByRole('table', { name: 'Cancelled users' })
  expect(within(cancelled).getByText('No cancelled users')).toBeInTheDocument()
  expect(within(cancelled).queryByText('No matching users')).not.toBeInTheDocument()
})

test('clears the active filters and restores the view', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await screen.findByRole('table', { name: 'Active users' })

  await user.type(searchBox(), 'zzz')
  await user.click(screen.getByRole('combobox', { name: 'Filter by role' }))
  await user.click(await screen.findByRole('option', { name: 'Observer' }))

  expect(screen.getByText('No matching users')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear filters' }))

  const active = screen.getByRole('table', { name: 'Active users' })
  expect(rowFor(active, 'amelie.bernard@portflow.test')).toBeInTheDocument()
  expect(rowFor(active, 'bruno.costa@portflow.test')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ search: '', role: 'all' })
})

test('keeps the visible set consistent when switching access status views', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })
  await user.type(searchBox(), 'e')

  await user.click(screen.getByRole('tab', { name: /Pending \(1\)/ }))

  const pending = await screen.findByRole('table', { name: 'Pending users' })

  expect(rowFor(pending, 'chloe.durand@portflow.test')).toBeInTheDocument()
  expect(rowFor(pending, 'amelie.bernard@portflow.test')).not.toBeInTheDocument()
})

test('sorts the visible users on identity and role', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  const active = await screen.findByRole('table', { name: 'Active users' })

  await user.click(within(active).getByRole('button', { name: /Role/ }))

  expect(router.state.location.search).toMatchObject({ sort: 'role', order: 'asc' })

  await user.click(within(active).getByRole('button', { name: /Name/ }))

  expect(router.state.location.search).toMatchObject({ sort: 'name', order: 'asc' })
})

test('restores the filters from the initial URL', async () => {
  mockUsers()

  const filters = new URLSearchParams({
    search: 'bruno',
    status: 'active',
    role: 'OPERATIONS_LEAD',
    sort: 'role',
    order: 'desc',
  })
  const { router } = renderUsers(`/users?${filters}`)

  await screen.findByRole('table', { name: 'Active users' })

  expect(searchBox()).toHaveValue('bruno')
  expect(router.state.location.search).toMatchObject({
    search: 'bruno',
    role: 'OPERATIONS_LEAD',
    sort: 'role',
    order: 'desc',
  })
})
