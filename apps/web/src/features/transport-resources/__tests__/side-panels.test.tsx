import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockTransportCompanies } from '@/features/transport-companies/__tests__/support/test-helpers'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { renderApp } from '@/test/render-app'

test('opens company details without changing the truck filter', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()
  mockTrucks()

  renderApp('/transport-resources')
  const companies = await screen.findByRole('list', { name: 'Available transport companies' })
  await user.click(within(companies).getByRole('button', { name: 'Actions for Bêta Logistique' }))
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))

  const details = await screen.findByRole('dialog')
  expect(within(details).getByText('Reactivation context')).toBeInTheDocument()
  expect(screen.getByText('AA-101-PF')).toBeInTheDocument()
})

test('opens and closes truck details while preserving the selected company', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()
  mockTrucks()

  const { router } = renderApp('/transport-resources')
  const companies = await screen.findByRole('list', { name: 'Available transport companies' })
  await user.click(
    within(companies).getByRole('button', {
      name: /Bêta Logistique, 00000000-0000-4000-8000-000000000002/,
    }),
  )
  const trucks = await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(within(trucks).getByRole('button', { name: /BB-202-PF/ }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    transportCompanyId: '00000000-0000-4000-8000-000000000002',
    truckId: '00000000-0000-4000-8000-000000000102',
  })

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await expect.poll(() => router.state.location.search).not.toHaveProperty('truckId')
  expect(router.state.location.search).toHaveProperty(
    'transportCompanyId',
    '00000000-0000-4000-8000-000000000002',
  )
})
