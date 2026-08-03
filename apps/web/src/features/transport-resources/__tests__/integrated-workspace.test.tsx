import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockTransportCompanies } from '@/features/transport-companies/__tests__/support/test-helpers'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_ADMIN,
  TRUCKS,
} from '@/features/trucks/__tests__/support/fixtures'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { renderApp } from '@/test/render-app'

test('starts with all permitted trucks and toggles a company filter by clicking twice', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()
  mockTrucks()

  const { router } = renderApp('/transport-resources')
  const companies = await screen.findByRole('list', { name: 'Transport companies' })
  const trucks = await screen.findByRole('list', { name: 'Available trucks' })

  expect(within(companies).getByText('Atlantic Transport')).toBeInTheDocument()
  expect(within(companies).getByText('Coastal Haulage')).toBeInTheDocument()
  expect(within(trucks).getByText('AA-101-PF')).toBeInTheDocument()
  expect(within(trucks).getByText('BB-202-PF')).toBeInTheDocument()
  expect(router.state.location.search).not.toHaveProperty('transportCompanyId')

  await user.click(
    within(companies).getByRole('button', {
      name: /Bêta Logistique, 00000000-0000-4000-8000-000000000002/,
    }),
  )
  expect(await screen.findByText('BB-202-PF')).toBeInTheDocument()
  expect(screen.queryByText('AA-101-PF')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    transportCompanyId: '00000000-0000-4000-8000-000000000002',
  })

  await user.click(
    within(companies).getByRole('button', {
      name: /Bêta Logistique, 00000000-0000-4000-8000-000000000002/,
    }),
  )
  expect(await screen.findByText('AA-101-PF')).toBeInTheDocument()
  expect(screen.getByText('BB-202-PF')).toBeInTheDocument()
  expect(router.state.location.search).not.toHaveProperty('transportCompanyId')
})

test('scopes lifecycle counts and searches to the selected company for administrators', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderApp('/transport-resources')
  const companies = await screen.findByRole('list', { name: 'Transport companies' })
  await user.click(
    within(companies).getByRole('button', {
      name: /Coastal Haulage, 00000000-0000-4000-8000-000000000003/,
    }),
  )

  expect(await screen.findByRole('tab', { name: /Available \(0\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))
  expect(await screen.findByText('CC-303-PF')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Search trucks' }), '303')
  expect(await screen.findByRole('button', { name: /CC-303-PF/ })).toBeInTheDocument()
  expect(screen.queryByText('BB-202-PF')).not.toBeInTheDocument()
})

test('does not expose archived companies trucks to non-administrators', async () => {
  mockTransportCompanies()
  mockTrucks({
    user: ACTIVE_OBSERVER,
    available: TRUCKS.filter((truck) => truck.status === 'AVAILABLE'),
  })

  renderApp('/transport-resources')
  await screen.findByRole('list', { name: 'Available trucks' })

  expect(screen.getByText('Coastal Haulage')).toBeInTheDocument()
  expect(screen.queryByText('CC-303-PF')).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /Archived/ })).not.toBeInTheDocument()
})
