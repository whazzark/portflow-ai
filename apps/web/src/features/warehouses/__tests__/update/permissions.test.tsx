import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN, WAREHOUSE_OBSERVER, WAREHOUSES } from '../support/fixtures'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const RETIRED_SHED = WAREHOUSES[1]

test('offers no update action to a user without warehouse management permission', async () => {
  const user = userEvent.setup()
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )

  expect(await screen.findByText(NORTH_SHED.name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('leaves the edit param inert for a user without permission', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${NORTH_SHED.id}&edit=warehouse`)

  expect(await screen.findByText(NORTH_SHED.name)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Warehouse name' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('boundary-point-0')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }),
  ).toBeEnabled()
})

test('offers no update action on an archived warehouse', async () => {
  const user = userEvent.setup()
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: 'View warehouse Retired Shed (Archived)' }),
  )

  expect(await screen.findByText(RETIRED_SHED.name)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('leaves the edit param inert on an archived warehouse', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(`/warehouses?status=all&warehouseId=${RETIRED_SHED.id}&edit=warehouse`)

  expect(await screen.findByText(RETIRED_SHED.name)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Warehouse name' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('boundary-point-0')).not.toBeInTheDocument()
})
