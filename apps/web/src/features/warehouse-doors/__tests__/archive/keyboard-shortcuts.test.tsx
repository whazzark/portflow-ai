import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import {
  BULK_WAREHOUSES,
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

const TWO_DOOR_WAREHOUSE = BULK_WAREHOUSES[1]
const ARCHIVED_WAREHOUSE = WAREHOUSES[1]
const COLLECTION = [TWO_DOOR_WAREHOUSE, ARCHIVED_WAREHOUSE]
const path = `/warehouses?status=all&warehouseId=${TWO_DOOR_WAREHOUSE.id}`

const doorList = () => screen.getByRole('list', { name: 'Available warehouse doors' })

const checkedDoors = () =>
  within(doorList())
    .queryAllByRole('checkbox')
    .filter((checkbox) => checkbox.getAttribute('aria-checked') === 'true')

/**
 * The doors of an open warehouse are the selection in front of the administrator, so Ctrl/Cmd+A
 * means them rather than the warehouses on the map behind — which the open sheet has already put
 * out of reach.
 */

test('Ctrl+A checks every available door of the open warehouse', async () => {
  const user = userEvent.setup()
  mockWarehouses(undefined, COLLECTION)

  renderWarehouses(path)
  await screen.findByRole('heading', { name: 'Doors' })

  await user.keyboard('{Control>}a{/Control}')

  expect(checkedDoors().length).toBeGreaterThan(1)
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('clears a shortcut-built selection from the panel, not with Escape', async () => {
  const user = userEvent.setup()
  mockWarehouses(undefined, COLLECTION)

  renderWarehouses(path)
  await screen.findByRole('heading', { name: 'Doors' })
  await user.keyboard('{Control>}a{/Control}')
  expect(checkedDoors().length).toBeGreaterThan(1)

  // Unlike the map's selection, the doors have no Escape binding: inside a sheet that key already
  // means "close this", which is a stronger convention than any shortcut we would add.
  await user.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(checkedDoors()).toHaveLength(0)
  expect(screen.getByRole('heading', { name: 'Doors' })).toBeInTheDocument()
})

test('offers no door shortcut to an active non-administrator', async () => {
  const user = userEvent.setup()
  mockWarehouses(WAREHOUSE_OBSERVER, COLLECTION)

  renderWarehouses(path)
  await screen.findByRole('heading', { name: 'Doors' })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
