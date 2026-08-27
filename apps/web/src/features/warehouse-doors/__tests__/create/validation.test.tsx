import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  CREATED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
  WAREHOUSES_WITH_CREATED_DOOR,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  createWarehouseDoorArchivedWarehouseHandler,
  createWarehouseDoorConflictHandler,
  createWarehouseDoorFailureHandler,
  createWarehouseDoorHandler,
  createWarehouseDoorOutsideFootprintHandler,
  createWarehouseDoorRecoveringHandler,
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

const path = `/warehouses?status=all&warehouseId=${WAREHOUSES[0].id}`

const submit = () => screen.getByRole('button', { name: 'Create door' })

async function openMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Create door' }))
}

async function placeDoor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'Simulate map click to place the door' }),
  )
}

test('blocks submission until the door has been placed', async () => {
  const user = userEvent.setup()
  renderWarehouses(path)

  await openMode(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'South Door')

  expect(submit()).toBeDisabled()
  expect(
    screen.getByText('Click the map inside the warehouse to place the door.'),
  ).toBeInTheDocument()
})

test('refuses a blank name on its own field', async () => {
  const user = userEvent.setup()
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), '   ')
  await user.click(submit())

  expect(await screen.findByText('Door name is required.')).toBeInTheDocument()
  expect(screen.getByTestId('pending-door')).toBeInTheDocument()
})

test('refuses a position outside the footprint before submitting', async () => {
  const user = userEvent.setup()
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'South Door')
  await user.click(
    screen.getByRole('button', {
      name: 'Simulate dragging the pending door outside the footprint',
    }),
  )

  expect(
    await screen.findByText('Place the door inside its warehouse footprint, or on its boundary.'),
  ).toBeInTheDocument()
  expect(submit()).toBeDisabled()
})

test('shows a field error and keeps the work when the name conflicts', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorConflictHandler())
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'North Door')
  await user.click(submit())

  expect(
    await screen.findByText('Warehouse door name is already in use in this warehouse'),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Door name' })).toHaveValue('North Door')
  expect(screen.getByTestId('pending-door')).toBeInTheDocument()
})

test('surfaces a server-side containment refusal at form level', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorOutsideFootprintHandler())
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'South Door')
  await user.click(submit())

  expect(
    await screen.findByText('Warehouse door must be placed within its warehouse footprint'),
  ).toBeInTheDocument()
  expect(screen.getByTestId('pending-door')).toBeInTheDocument()
})

test('explains that an archived warehouse must be reactivated first', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorArchivedWarehouseHandler())
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'South Door')
  await user.click(submit())

  expect(
    await screen.findByText('Archived warehouses are read-only. Reactivate the warehouse first.'),
  ).toBeInTheDocument()
})

test('refuses a coordinate outside its legal range on its own field', async () => {
  const user = userEvent.setup()
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  const latitude = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitude)
  await user.type(latitude, '120')

  expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  expect(submit()).toBeDisabled()
})

test('reports a transient failure without creating or losing anything', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorFailureHandler())
  renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'South Door')
  await user.click(submit())

  expect(await screen.findByText('Unable to create door “South Door”')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Door name' })).toHaveValue('South Door')
  expect(screen.getByTestId('pending-door')).toBeInTheDocument()
})

test('creates exactly one door when a failed submission is retried', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorRecoveringHandler(CREATED_DOOR))
  const { router } = renderWarehouses(path)

  await openMode(user)
  await placeDoor(user)
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'South Door')
  await user.click(submit())
  await screen.findByText('Unable to create door “South Door”')

  // The refetch that follows a successful retry must already carry the door, or the page rightly
  // drops a `doorId` its collection does not contain.
  server.use(warehousesHandler(WAREHOUSES_WITH_CREATED_DOOR))
  await user.click(submit())

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ doorId: CREATED_DOOR.id }),
  )
  expect(router.state.location.search).not.toHaveProperty('create')
})

test('does not offer the creation handler when nothing was submitted', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseDoorHandler(CREATED_DOOR))
  const { router } = renderWarehouses(path)

  await openMode(user)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(router.state.location.search).not.toHaveProperty('doorId')
})
