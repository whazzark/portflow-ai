import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import {
  WAREHOUSE_ADMIN,
  WAREHOUSE_OBSERVER,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const AVAILABLE = WAREHOUSES[0]
const ARCHIVED = WAREHOUSES[1]

test('offers the action on an available warehouse to an administrator', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  expect(await screen.findByRole('button', { name: 'Create door' })).toBeInTheDocument()
})

test('withholds the action from a user without warehouse management permission', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('button', { name: 'Create door' })).not.toBeInTheDocument()
})

test('withholds the action on an archived warehouse rather than disabling it', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED.id}`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('button', { name: 'Create door' })).not.toBeInTheDocument()
})

test('leaves the mode inert without warehouse management permission', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}&create=door`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Simulate map click to place the door' }),
  ).not.toBeInTheDocument()
})

test('leaves the mode inert on an archived warehouse', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED.id}&create=door`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Simulate map click to place the door' }),
  ).not.toBeInTheDocument()
})

test('leaves the mode inert when no warehouse is named or the identifier is unknown', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const { unmount } = renderWarehouses('/warehouses?status=all&create=door')

  await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' })
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
  unmount()

  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses('/warehouses?status=all&warehouseId=unknown-id&create=door')

  await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' })
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
})

test('keeps the map selectable while the mode is inert', async () => {
  const user = userEvent.setup()
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}&create=door`)

  const polygon = await screen.findByRole('button', {
    name: 'View warehouse Retired Shed (Archived)',
  })
  expect(polygon).toBeEnabled()
  await user.click(polygon)

  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
})
