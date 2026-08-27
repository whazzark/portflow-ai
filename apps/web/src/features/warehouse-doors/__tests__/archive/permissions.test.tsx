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
const DOOR = (AVAILABLE.doors ?? [])[0]

test('offers no action menu at all to a non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  expect(await screen.findByText(DOOR.name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: `Actions for ${DOOR.name}` })).not.toBeInTheDocument()
})

test('offers the archive entry to an administrator on the same row', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))

  expect(await screen.findByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
})
