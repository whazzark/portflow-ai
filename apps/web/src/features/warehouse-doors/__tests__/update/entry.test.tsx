import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  UPDATED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
  WAREHOUSES_WITH_UPDATED_DOOR,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  updateWarehouseDoorHandler,
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

const AVAILABLE = WAREHOUSES[0]
const DOOR = (AVAILABLE.doors ?? [])[0]

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

test('offers an action menu on each available door row', async () => {
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  expect(
    await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }),
  ).toBeInTheDocument()
})

test('offers Edit, and only Edit, inside the menu', async () => {
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))

  const items = await screen.findAllByRole('menuitem')
  expect(items.map((item) => item.textContent)).toEqual(['Edit'])
  // Archiving and reactivating belong to #215 and #216; this slice only chooses the container.
  expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('selects the door and opens its session in one step, without pre-selecting it', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      doorId: DOOR.id,
      edit: 'door',
      warehouseId: AVAILABLE.id,
    }),
  )
  expect(await screen.findByRole('heading', { name: 'Edit door' })).toBeInTheDocument()
})

test('pre-fills the panel with the door’s current name and coordinates', async () => {
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door`)

  expect(await screen.findByRole('textbox', { name: 'Door name' })).toHaveValue(DOOR.name)
  expect(screen.getByLabelText('Latitude')).toHaveValue(String(DOOR.latitude))
  expect(screen.getByLabelText('Longitude')).toHaveValue(String(DOOR.longitude))
})

const EDIT_PATH = `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door`

test('saves a corrected name and keeps the door selected', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorHandler(UPDATED_DOOR))
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.clear(screen.getByRole('textbox', { name: 'Door name' }))
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), UPDATED_DOOR.name)

  server.use(warehousesHandler(WAREHOUSES_WITH_UPDATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  // The selection, the lifecycle view, and the search term all survive: a door rename can hide
  // nothing, because the collection filter matches warehouses.
  expect(router.state.location.search).toMatchObject({
    doorId: DOOR.id,
    warehouseId: AVAILABLE.id,
  })
  expect(await screen.findByText(UPDATED_DOOR.name)).toBeInTheDocument()
  expect(await screen.findByText(`Door “${UPDATED_DOOR.name}” updated`)).toBeInTheDocument()
})

test('saves a repositioned door without touching its name', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorHandler(UPDATED_DOOR))
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.click(screen.getByRole('button', { name: 'Simulate dragging the door being edited' }))

  server.use(warehousesHandler(WAREHOUSES_WITH_UPDATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(await screen.findByText(`Door “${UPDATED_DOOR.name}” updated`)).toBeInTheDocument()
})

test('accepts a resubmission of the current name and position unchanged', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorHandler(UPDATED_DOOR))
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  // Nothing disables the button on a no-op: an unchanged submission is a legitimate success.
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
})
