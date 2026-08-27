import { screen, waitFor, within } from '@testing-library/react'
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
const EDIT_PATH = `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door`

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

const dragDraft = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Simulate dragging the door being edited' }))

test('announces a modified position and restores the snapshotted origin', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()

  await dragDraft(user)

  expect(await screen.findByText('Position modified')).toBeInTheDocument()
  expect(screen.getByLabelText('Latitude')).not.toHaveValue(String(DOOR.latitude))

  await user.click(screen.getByRole('button', { name: 'Restore original position' }))

  await waitFor(() => expect(screen.getByLabelText('Latitude')).toHaveValue(String(DOOR.latitude)))
  expect(screen.getByLabelText('Longitude')).toHaveValue(String(DOOR.longitude))
  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()
})

test('cancelling leaves the stored door untouched and returns to the details', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.clear(screen.getByRole('textbox', { name: 'Door name' }))
  await user.type(screen.getByRole('textbox', { name: 'Door name' }), 'Abandoned')
  await dragDraft(user)

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
  // The stored door is what the list shows: nothing typed or dragged reached it.
  expect(
    within(screen.getByRole('list', { name: 'Available warehouse doors' })).getByText(DOOR.name),
  ).toBeInTheDocument()
  expect(screen.queryByText('Abandoned')).not.toBeInTheDocument()
})

test('leaving through the back action ends the session without saving', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.click(screen.getByRole('button', { name: 'Back to details' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
})

test('opens no session for a door that does not belong to the selected warehouse', async () => {
  // The session never outlives the selection it belongs to. It cannot be ended by *clicking*
  // another warehouse — polygons are unselectable while it is open (FR-005a) — so the rule is
  // exercised through a URL naming a mismatched pair, which is also how a shared link arrives.
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${WAREHOUSES[1].id}&doorId=${DOOR.id}&edit=door`,
  )

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('doorId'))
})

test('drops a door-scoped edit whose door selection has gone', async () => {
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${AVAILABLE.id}&edit=door`,
  )

  await screen.findByRole('heading', { name: 'Doors' })
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
})

test('activating door creation ends the session without saving it', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.click(screen.getByRole('button', { name: 'Back to details' }))
  await user.click(await screen.findByRole('button', { name: 'Create door' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ create: 'door' }))
  expect(router.state.location.search).not.toHaveProperty('edit')
  expect(screen.queryByRole('heading', { name: 'Edit door' })).not.toBeInTheDocument()
})
