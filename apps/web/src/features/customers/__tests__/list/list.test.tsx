import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { OBSERVER } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('renders customers through status tabs with available selected by default', async () => {
  mockCustomers()

  const { router } = renderCustomers()
  const available = await screen.findByRole('table', { name: 'Available customers' })

  expect(within(available).getByText('ACME-01')).toBeInTheDocument()
  expect(within(available).getByText('BETA-02')).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Archived customers' })).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Available \(2\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tablist', { name: 'Customer status' })).toHaveAttribute(
    'data-variant',
    'line',
  )
  expect(router.state.location.search).toMatchObject({ status: 'available' })
  expect(screen.getByRole('button', { name: 'Create customer' })).toBeInTheDocument()
})

test('switches status tabs and filters the active customer list', async () => {
  const user = userEvent.setup()
  mockCustomers()

  const { router } = renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))

  expect(await screen.findByRole('table', { name: 'Archived customers' })).toBeInTheDocument()
  expect(screen.queryByText('ACME-01')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ status: 'archived' })

  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'beta')

  expect(
    within(screen.getByRole('table', { name: 'Archived customers' })).getByText(
      'No matching customers',
    ),
  ).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ q: 'beta', status: 'archived' })
})

test('highlights matching code and company text using the customer search normalization', async () => {
  const user = userEvent.setup()
  mockCustomers()

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'beta')

  expect(document.querySelectorAll('mark')).toHaveLength(2)
  expect(document.querySelectorAll('mark')[0]).toHaveTextContent('BETA')
  expect(document.querySelectorAll('mark')[1]).toHaveTextContent('Bêta')
})

test('sorts each customer table and updates the URL state', async () => {
  const user = userEvent.setup()
  mockCustomers()

  const { router } = renderCustomers()
  const available = await screen.findByRole('table', { name: 'Available customers' })
  await user.click(within(available).getByRole('button', { name: /Company name/ }))

  const codes = within(available)
    .getAllByRole('button')
    .filter((button) => ['ACME-01', 'BETA-02'].includes(button.textContent ?? ''))
    .map((button) => button.textContent)

  expect(codes).toEqual(['ACME-01', 'BETA-02'])
  expect(router.state.location.search).toMatchObject({
    availableSort: 'companyName',
    availableOrder: 'asc',
  })
})

test('keeps the customer page read-only for observers', async () => {
  mockCustomers(OBSERVER)

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })

  expect(screen.queryByRole('button', { name: 'Create customer' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View customer ACME-01' })).toBeInTheDocument()
})
