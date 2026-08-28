import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  REACTIVATABLE_DOOR,
  REACTIVATED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
  WAREHOUSES_WITH_REACTIVATED_DOOR,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  reactivateWarehouseDoorHandler,
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

const WAREHOUSE = WAREHOUSES[0]
const DOOR = REACTIVATABLE_DOOR

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

const archivedView = () =>
  renderWarehouses(`/warehouses?status=all&warehouseId=${WAREHOUSE.id}&doorStatus=archived`)

const openConfirmation = async () => {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Reactivate' }))

  return user
}

test('confirms with the shared wording, naming the door', async () => {
  archivedView()

  await openConfirmation()

  expect(await screen.findByRole('heading', { name: 'Reactivate door?' })).toBeInTheDocument()
  expect(
    screen.getByText(`“${DOOR.name}” becomes available again for new operations.`),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Comment (optional)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
})

test('sends the comment and confirms the reactivation', async () => {
  server.use(reactivateWarehouseDoorHandler(REACTIVATED_DOOR))
  archivedView()

  const user = await openConfirmation()
  await user.type(await screen.findByLabelText('Comment (optional)'), 'Back in service after works')
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Door “${DOOR.name}” reactivated`)).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Reactivate door?' })).not.toBeInTheDocument(),
  )
})

test('refetches the warehouse collection so the door changes lifecycle view', async () => {
  server.use(reactivateWarehouseDoorHandler(REACTIVATED_DOOR))
  archivedView()

  const user = await openConfirmation()
  server.use(warehousesHandler(WAREHOUSES_WITH_REACTIVATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  // The archived view no longer lists it — it was the only archived door, so the view is empty…
  expect(
    await screen.findByText('No archived warehouse doors in this warehouse.'),
  ).toBeInTheDocument()

  // …and the tab counts have moved with it.
  expect(await screen.findByRole('tab', { name: 'Available (2)' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Archived (0)' })).toBeInTheDocument()
})

test('stays on the archived view rather than following the door', async () => {
  server.use(reactivateWarehouseDoorHandler(REACTIVATED_DOOR))
  const { router } = archivedView()

  const user = await openConfirmation()
  server.use(warehousesHandler(WAREHOUSES_WITH_REACTIVATED_DOOR))
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Door “${DOOR.name}” reactivated`)).toBeInTheDocument()
  // An administrator working through a batch of archived doors must not be moved once per door.
  expect(router.state.location.search).toMatchObject({ doorStatus: 'archived' })
})

test('shows the reactivation context on the available row and drops the archive line', async () => {
  server.use(
    reactivateWarehouseDoorHandler(REACTIVATED_DOOR),
    warehousesHandler(WAREHOUSES_WITH_REACTIVATED_DOOR),
  )
  renderWarehouses(`/warehouses?status=all&warehouseId=${WAREHOUSE.id}&doorStatus=available`)

  // Scoped to the list, and anchored: the map marker and the row's own `Actions for …` trigger
  // both carry the door's name, while only the row button's name starts with it.
  const doors = await screen.findByRole('list', { name: 'Available warehouse doors' })
  const row = within(doors).getByRole('button', { name: new RegExp(`^${DOOR.name}`) })

  expect(row).toHaveTextContent('Reactivated')
  expect(row).toHaveTextContent('Back in service after works')
  // `archivedAt` survives the transition on purpose; the status is what withholds the line.
  expect(row).not.toHaveTextContent('Archived on its own')
})

test('leaves the door archived when the confirmation is cancelled', async () => {
  const reactivate = vi.fn()
  server.use(reactivateWarehouseDoorHandler(REACTIVATED_DOOR))
  archivedView()

  const user = await openConfirmation()
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))

  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Reactivate door?' })).not.toBeInTheDocument(),
  )
  expect(reactivate).not.toHaveBeenCalled()
  expect(
    within(screen.getByRole('list', { name: 'Archived warehouse doors' })).getByText(DOOR.name),
  ).toBeInTheDocument()
})
