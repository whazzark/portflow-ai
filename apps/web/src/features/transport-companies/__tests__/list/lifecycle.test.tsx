import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

test('shows available companies by default with unfiltered lifecycle counts', async () => {
  mockTransportCompanies()

  const { router } = renderTransportCompanies()
  const available = await screen.findByRole('list', { name: 'Available transport companies' })

  expect(within(available).getByText('Atlantic Transport')).toBeInTheDocument()
  expect(within(available).queryByText('Coastal Haulage')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Available \(2\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'All transport companies' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Transport resources' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Transport companies' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /All transport companies/ })).not.toBeInTheDocument()
  expect(within(available).queryByText('Available')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ companyStatus: 'available' })
})

test('switches to archived companies and remains read-only', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))

  const archived = await screen.findByRole('list', { name: 'Archived transport companies' })
  expect(within(archived).getByText('Coastal Haulage')).toBeInTheDocument()
  expect(within(archived).queryByText('Archived')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', {
      name: /^(create|edit|archive|reactivate|delete|import|sync)/i,
    }),
  ).not.toBeInTheDocument()
})

test('keeps a zero-record lifecycle selectable', async () => {
  const user = userEvent.setup()
  mockTransportCompanies([])

  renderTransportCompanies()
  expect(await screen.findByText('No available transport companies')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Archived \(0\)/ }))

  expect(await screen.findByText('No archived transport companies')).toBeInTheDocument()
})
