import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WAREHOUSE_OBSERVER, WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]

async function openWarehouse(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${NORTH_SHED.name} (Available)` }),
  )
}

test('offers no archive action to an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  const user = userEvent.setup()
  renderWarehouses()

  await openWarehouse(user)

  expect(await screen.findByText(NORTH_SHED.name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive warehouse' })).not.toBeInTheDocument()
})

test('offers the archive action to an administrator', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  await openWarehouse(user)

  expect(await screen.findByRole('button', { name: 'Archive warehouse' })).toBeInTheDocument()
})

test('offers no archive action on an already archived warehouse', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${WAREHOUSES[1].name} (Archived)` }),
  )

  expect(await screen.findByText(WAREHOUSES[1].name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive warehouse' })).not.toBeInTheDocument()
})
