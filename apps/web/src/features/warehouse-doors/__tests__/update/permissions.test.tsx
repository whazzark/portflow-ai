import { screen, waitFor } from '@testing-library/react'
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
const DOOR = (AVAILABLE.doors ?? [])[0]
const ARCHIVED_DOOR = (AVAILABLE.doors ?? [])[1]
const ARCHIVED_WAREHOUSE_DOOR = (ARCHIVED.doors ?? [])[0]

test('withholds the row menu from a user without warehouse management permission', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('button', { name: `Actions for ${DOOR.name}` })).not.toBeInTheDocument()
})

test('renders no menu at all on an archived door, rather than a dead item', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorStatus=archived`)

  expect(await screen.findByText(ARCHIVED_DOOR.name)).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Actions for ${ARCHIVED_DOOR.name}` }),
  ).not.toBeInTheDocument()
})

test('renders no menu under an archived warehouse', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED.id}`)

  expect(await screen.findByText(ARCHIVED_WAREHOUSE_DOOR.name)).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Actions for ${ARCHIVED_WAREHOUSE_DOOR.name}` }),
  ).not.toBeInTheDocument()
})

test('leaves the mode inert without warehouse management permission', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('draft-door')).not.toBeInTheDocument()
})

test('leaves the mode inert on an archived door', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorStatus=archived&doorId=${ARCHIVED_DOOR.id}&edit=door`,
  )

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
  // Dormant rather than dropped, the param would arm the session the moment #216 reactivated it.
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
})

test('leaves the mode inert under an archived warehouse', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${ARCHIVED.id}&doorId=${ARCHIVED_WAREHOUSE_DOOR.id}&edit=door`,
  )

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
})

test('leaves the mode inert when the door identifier is unknown', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=unknown-id&edit=door`,
  )

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('doorId'))
})

test('a creation mode wins over a door update, so the two never coexist', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  renderWarehouses(
    `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door&create=door`,
  )

  expect(await screen.findByRole('heading', { name: 'Create door' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
})
