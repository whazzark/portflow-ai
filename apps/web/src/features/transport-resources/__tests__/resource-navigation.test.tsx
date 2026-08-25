import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { mockTransportCompanies } from '@/features/transport-companies/__tests__/support/test-helpers'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { renderApp } from '@/test/render-app'

test('opens the integrated company-and-truck workspace by default', async () => {
  mockTransportCompanies()
  mockTrucks()

  const { router } = renderApp('/transport-resources')
  expect(
    await screen.findByRole('list', { name: 'Available transport companies' }),
  ).toBeInTheDocument()
  expect(await screen.findByRole('list', { name: 'Available trucks' })).toBeInTheDocument()
  expect(router.state.location.search).not.toHaveProperty('resource')
})
