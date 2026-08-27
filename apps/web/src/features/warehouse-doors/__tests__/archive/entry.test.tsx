import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN, WAREHOUSES } from '@/features/warehouses/__tests__/support/fixtures'
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
const ARCHIVED_DOOR_ROW = (AVAILABLE.doors ?? [])[1]
const ARCHIVED_WAREHOUSE = WAREHOUSES[1]

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

test('offers Edit then Archive on an available door of an available warehouse', async () => {
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))

  const items = await screen.findAllByRole('menuitem')
  expect(items.map((item) => item.textContent)).toEqual(['Edit', 'Archive'])
  // Reactivation belongs to #216; this slice fills the container with one entry only.
  expect(screen.queryByRole('menuitem', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('renders no menu at all on an archived door row', async () => {
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorStatus=archived`)

  expect(await screen.findByText(ARCHIVED_DOOR_ROW.name)).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Actions for ${ARCHIVED_DOOR_ROW.name}` }),
  ).not.toBeInTheDocument()
})

test('renders no menu on any door of an archived warehouse', async () => {
  const doors = ARCHIVED_WAREHOUSE.doors ?? []
  renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED_WAREHOUSE.id}`)

  await screen.findByRole('heading', { name: 'Doors' })
  for (const door of doors) {
    expect(
      screen.queryByRole('button', { name: `Actions for ${door.name}` }),
    ).not.toBeInTheDocument()
  }
})

test('names the door and states what archiving means, with no cascade clause', async () => {
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByRole('heading', { name: 'Archive door?' })).toBeInTheDocument()
  expect(dialog).toHaveTextContent(DOOR.name)
  expect(dialog).toHaveTextContent('no longer available for new operations')
  // A door cascades onto nothing: the warehouse sentence must not leak into this one.
  expect(dialog).not.toHaveTextContent(/door(s)? (is|are) archived with it/)
})
