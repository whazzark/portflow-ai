import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  REACTIVATABLE_DOOR,
  REACTIVATED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  reactivateWarehouseDoorAlreadyAvailableHandler,
  reactivateWarehouseDoorArchivedWithWarehouseHandler,
  reactivateWarehouseDoorCommentTooLongHandler,
  reactivateWarehouseDoorFailureHandler,
  reactivateWarehouseDoorRecoveringHandler,
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

const WAREHOUSE = WAREHOUSES[0]
const DOOR = REACTIVATABLE_DOOR

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

const openConfirmation = async () => {
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${WAREHOUSE.id}&doorStatus=archived`)
  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Reactivate' }))

  return user
}

const dialogIsOpen = () => screen.queryByRole('heading', { name: 'Reactivate door?' }) !== null

test('keeps the dialog open with the typed comment when the door is already available', async () => {
  server.use(reactivateWarehouseDoorAlreadyAvailableHandler(DOOR.id))

  const user = await openConfirmation()
  await user.type(await screen.findByLabelText('Comment (optional)'), 'Reopening')
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Unable to reactivate door “${DOOR.name}”`)).toBeInTheDocument()
  expect(await screen.findByText('Warehouse door is already available')).toBeInTheDocument()
  expect(dialogIsOpen()).toBe(true)
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue('Reopening')
})

// The remedy is one step, and the message has to say so: reactivating the warehouse brings this
// door back with it, rather than freeing it to be reactivated in turn.
test('reports an archived containing warehouse with its one-step remedy', async () => {
  server.use(reactivateWarehouseDoorArchivedWithWarehouseHandler(DOOR.id))

  const user = await openConfirmation()
  await user.click(await screen.findByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText(
      'This warehouse door was archived with its warehouse. Reactivate the warehouse and the door returns with it.',
    ),
  ).toBeInTheDocument()
})

test('surfaces the field-level message of a comment validation failure', async () => {
  server.use(reactivateWarehouseDoorCommentTooLongHandler(DOOR.id))

  const user = await openConfirmation()
  await user.type(await screen.findByLabelText('Comment (optional)'), 'Too long')
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  // A 422's top-level message is only "Validation failure"; the detail is what tells the
  // administrator what to fix.
  expect(
    await screen.findByText('The comment field must not be greater than 1000 characters'),
  ).toBeInTheDocument()
  expect(dialogIsOpen()).toBe(true)
})

test('keeps the door reactivatable after a transient failure and succeeds on retry', async () => {
  server.use(reactivateWarehouseDoorRecoveringHandler(REACTIVATED_DOOR))

  const user = await openConfirmation()
  await user.type(await screen.findByLabelText('Comment (optional)'), 'Retrying')
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  expect(dialogIsOpen()).toBe(true)
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue('Retrying')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Door “${DOOR.name}” reactivated`)).toBeInTheDocument()
  await waitFor(() => expect(dialogIsOpen()).toBe(false))
})

test('leaves the door archived when the request fails outright', async () => {
  server.use(reactivateWarehouseDoorFailureHandler(DOOR.id))

  const user = await openConfirmation()
  await user.click(await screen.findByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Unable to reactivate door “${DOOR.name}”`)).toBeInTheDocument()
  // The confirmation survives the failure, so the administrator retries without rebuilding it.
  expect(dialogIsOpen()).toBe(true)
  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeEnabled()
})
