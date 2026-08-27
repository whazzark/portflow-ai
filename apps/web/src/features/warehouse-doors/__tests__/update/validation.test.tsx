import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  UPDATED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  updateWarehouseDoorArchivedHandler,
  updateWarehouseDoorConflictHandler,
  updateWarehouseDoorFailureHandler,
  updateWarehouseDoorNotFoundHandler,
  updateWarehouseDoorOutsideFootprintHandler,
  updateWarehouseDoorRecoveringHandler,
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
const EDIT_PATH = `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door`

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function retype(user: ReturnType<typeof userEvent.setup>, name: string) {
  const field = screen.getByRole('textbox', { name: 'Door name' })
  await user.clear(field)
  if (name) {
    await user.type(field, name)
  }
}

test('refuses a blank name on the field and leaves the session open', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await retype(user, '   ')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Door name is required.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit door' })).toBeInTheDocument()
})

test('shows a duplicate name on the name field, keeping the entered name', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorConflictHandler(DOOR.id))
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await retype(user, 'Old Door')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('Warehouse door name is already in use in this warehouse'),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Door name' })).toHaveValue('Old Door')
})

test('refuses a draft outside the footprint before it is ever submitted', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.click(
    screen.getByRole('button', {
      name: 'Simulate dragging the door being edited outside the footprint',
    }),
  )

  expect(
    await screen.findByText('Keep the door inside its warehouse footprint, or on its boundary.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('surfaces a server containment refusal at form level, keeping the draft', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorOutsideFootprintHandler(DOOR.id))
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.click(screen.getByRole('button', { name: 'Simulate dragging the door being edited' }))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('Warehouse door must be placed within its warehouse footprint'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Latitude')).toHaveValue(String(DOOR.latitude + 0.0005))
})

test('reports an out-of-range coordinate on its own field', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.clear(screen.getByLabelText('Latitude'))
  await user.type(screen.getByLabelText('Latitude'), '91')

  expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('reports a non-numeric coordinate on its own field', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.clear(screen.getByLabelText('Longitude'))
  await user.type(screen.getByLabelText('Longitude'), 'north')

  expect(await screen.findByText('Longitude must be a number.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('states that an archived door must be reactivated first', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorArchivedHandler(DOOR.id))
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await retype(user, 'Door 4')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('Archived warehouse doors are read-only. Reactivate the door first.'),
  ).toBeInTheDocument()
  // The session does not silently end on a refusal the administrator can act on.
  expect(screen.getByRole('heading', { name: 'Edit door' })).toBeInTheDocument()
})

test('returns to consultation when the door is gone', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorNotFoundHandler(DOOR.id))
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await retype(user, 'Door 4')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(router.state.location.search).not.toHaveProperty('doorId')
  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
})

test('keeps the name and the draft after a transient failure', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorFailureHandler(DOOR.id))
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await retype(user, 'Door 4')
  await user.click(screen.getByRole('button', { name: 'Simulate dragging the door being edited' }))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText(`Unable to update door “${DOOR.name}”`)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Door name' })).toHaveValue('Door 4')
  expect(screen.getByLabelText('Latitude')).toHaveValue(String(DOOR.latitude + 0.0005))
  expect(screen.getByRole('heading', { name: 'Edit door' })).toBeInTheDocument()
})

test('applies the correction exactly once when a failed submission is retried', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorRecoveringHandler({ ...UPDATED_DOOR, id: DOOR.id }))
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await retype(user, 'Door 4')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await screen.findByText(`Unable to update door “${DOOR.name}”`)
  expect(router.state.location.search).toMatchObject({ edit: 'door' })

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(await screen.findByText('Door updated')).toBeInTheDocument()
})
