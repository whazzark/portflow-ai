import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

test('shows available companies by default with unfiltered lifecycle counts', async () => {
  mockTrucks()
  mockTransportCompanies()

  const { router } = renderTransportCompanies()
  const available = await screen.findByRole('list', { name: 'Available transport companies' })
  const companyTabs = screen.getByRole('tablist', { name: 'Transport company status' })

  expect(within(available).getByText('Atlantic Transport')).toBeInTheDocument()
  expect(within(available).queryByText('Coastal Haulage')).not.toBeInTheDocument()
  expect(within(companyTabs).getByRole('tab', { name: /Available \(2\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(within(companyTabs).getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()
  expect(within(available).queryByText('Available')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ companyStatus: 'available' })
})

test('switches to archived companies and remains read-only', async () => {
  const user = userEvent.setup()
  mockTrucks()
  mockTransportCompanies()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  const companyTabs = screen.getByRole('tablist', { name: 'Transport company status' })
  await user.click(within(companyTabs).getByRole('tab', { name: /Archived \(1\)/ }))

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
  mockTrucks()
  mockTransportCompanies([])

  renderTransportCompanies()
  expect(await screen.findByText('No available transport companies')).toBeInTheDocument()
  const companyTabs = screen.getByRole('tablist', { name: 'Transport company status' })
  await user.click(within(companyTabs).getByRole('tab', { name: /Archived \(0\)/ }))

  expect(await screen.findByText('No archived transport companies')).toBeInTheDocument()
})
