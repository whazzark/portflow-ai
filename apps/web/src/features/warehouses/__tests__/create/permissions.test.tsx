import { screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { WAREHOUSE_OBSERVER } from '../support/fixtures'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

beforeEach(() => {
  mockWarehouses(WAREHOUSE_OBSERVER)
})

test('does not offer warehouse creation to a user without management permission', async () => {
  renderWarehouses()

  await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' })

  expect(screen.queryByRole('button', { name: 'Create warehouse' })).not.toBeInTheDocument()
})

test('keeps a directly requested creation mode inert for an unpermitted user', async () => {
  renderWarehouses('/warehouses?create=warehouse')

  const warehouseButton = await screen.findByRole('button', {
    name: 'View warehouse North Shed (Available)',
  })

  expect(screen.queryByRole('heading', { name: 'Create warehouse' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Simulate map click to add footprint point' }),
  ).not.toBeInTheDocument()
  // The map is not armed, so warehouses stay selectable.
  expect(warehouseButton).toBeEnabled()
})
