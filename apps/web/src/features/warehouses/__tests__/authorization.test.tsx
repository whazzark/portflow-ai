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
  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('offers the archive action to an administrator', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  await openWarehouse(user)

  expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('offers reactivation rather than archival on an already archived warehouse', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${WAREHOUSES[1].name} (Archived)` }),
  )

  expect(await screen.findByText(WAREHOUSES[1].name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
})

test('offers no reactivate action to an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${WAREHOUSES[1].name} (Archived)` }),
  )

  expect(await screen.findByText(WAREHOUSES[1].name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

// The select control is what starts a bulk lifecycle action in either direction, so a
// non-administrator must not reach it even by asking for the mode in the URL.
test('leaves the bulk selection mode inert for an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses('/warehouses?selecting=warehouses')

  expect(
    await screen.findByRole('button', {
      name: `View warehouse ${WAREHOUSES[0].name} (Available)`,
    }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Select warehouses' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
