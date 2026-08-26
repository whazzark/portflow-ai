import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  CREATED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
  WAREHOUSES_WITH_CREATED_DOOR,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  createWarehouseDoorHandler,
  warehousesHandler,
} from '@/features/warehouses/__tests__/support/handlers'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'
import { server } from '@/test/msw/server'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function placeAndName(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Create door' }))
  await user.click(
    await screen.findByRole('button', { name: 'Simulate map click to place the door' }),
  )
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), name)
}

async function selectNorthShed(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
}

test('creates the door and reveals it selected in the available view', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorHandler(CREATED_DOOR))
  const { router } = renderWarehouses()

  await selectNorthShed(user)
  await placeAndName(user, CREATED_DOOR.name)

  server.use(warehousesHandler(WAREHOUSES_WITH_CREATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Create door' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(router.state.location.search).toMatchObject({
    doorId: CREATED_DOOR.id,
    doorStatus: 'available',
    warehouseId: WAREHOUSES[0].id,
  })

  const list = await screen.findByRole('list', { name: 'Available warehouse doors' })
  expect(within(list).getByText(CREATED_DOOR.name)).toBeInTheDocument()
})

test('reveals the new door even when the archived view was selected', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorHandler(CREATED_DOOR))
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${WAREHOUSES[0].id}&doorStatus=archived`,
  )

  await placeAndName(user, CREATED_DOOR.name)

  server.use(warehousesHandler(WAREHOUSES_WITH_CREATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Create door' }))

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ doorStatus: 'available' }),
  )
  const list = await screen.findByRole('list', { name: 'Available warehouse doors' })
  expect(within(list).getByText(CREATED_DOOR.name)).toBeInTheDocument()
})

test('leaves the lifecycle filter and the search term untouched', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorHandler(CREATED_DOOR))
  const { router } = renderWarehouses(
    `/warehouses?status=available&search=North&warehouseId=${WAREHOUSES[0].id}`,
  )

  await placeAndName(user, CREATED_DOOR.name)

  server.use(warehousesHandler(WAREHOUSES_WITH_CREATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Create door' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(router.state.location.search).toMatchObject({ search: 'North', status: 'available' })
})

test('confirms the creation with a notification', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorHandler(CREATED_DOOR))
  renderWarehouses(`/warehouses?status=all&warehouseId=${WAREHOUSES[0].id}`)

  await placeAndName(user, CREATED_DOOR.name)

  server.use(warehousesHandler(WAREHOUSES_WITH_CREATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Create door' }))

  expect(await screen.findByText('Door created')).toBeInTheDocument()
})
