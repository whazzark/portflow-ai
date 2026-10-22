import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('points to the archived customers a search matches when none is available', async () => {
  const user = userEvent.setup()
  mockCustomers()

  const { router } = renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'harbor')

  expect(await screen.findByText('No available customer matches “harbor”')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Search looks in customer codes, company names and lifecycle comments. 1 archived customer matches.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Available customers' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Show archived' }))

  const archived = await screen.findByRole('table', { name: 'Archived customers' })
  expect(within(archived).getByText('OLD-03')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Search customers' })).toHaveValue('harbor')
  expect(router.state.location.search).toMatchObject({ search: 'harbor', status: 'archived' })
})

test('clears the search from the no-match state', async () => {
  const user = userEvent.setup()
  mockCustomers()

  const { router } = renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'zzt')

  expect(await screen.findByText('No available customer matches “zzt”')).toBeInTheDocument()
  expect(
    screen.getByText('Search looks in customer codes, company names and lifecycle comments.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Show archived' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear search' }))

  expect(await screen.findByRole('table', { name: 'Available customers' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Search customers' })).toHaveValue('')
  expect(router.state.location.search).toMatchObject({ search: '' })
})

test('points back to the available customers from the archived tab', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers('/customers?status=archived&search=acme')

  expect(await screen.findByText('No archived customer matches “acme”')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Search looks in customer codes, company names and lifecycle comments. 1 available customer matches.',
    ),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Show available' }))

  expect(await screen.findByRole('table', { name: 'Available customers' })).toBeInTheDocument()
})
