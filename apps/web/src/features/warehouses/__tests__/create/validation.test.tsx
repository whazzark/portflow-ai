import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { WAREHOUSE_ADMIN } from '../support/fixtures'
import {
  createWarehouseConflictHandler,
  createWarehouseFailureHandler,
  createWarehouseInvalidFootprintHandler,
} from '../support/handlers'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

const submitButton = () =>
  screen
    .getAllByRole('button', { name: 'Create warehouse' })
    .find((button) => button.getAttribute('type') === 'submit') as HTMLElement

async function startDrawing(user: ReturnType<typeof userEvent.setup>, clicks = 3) {
  const { router } = renderWarehouses()
  await user.click(await screen.findByRole('button', { name: 'Create warehouse' }))
  for (let click = 0; click < clicks; click += 1) {
    await user.click(
      screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
    )
  }
  return router
}

test('blocks submission and explains the minimum below three boundary points', async () => {
  const user = userEvent.setup()
  await startDrawing(user, 2)

  expect(
    screen.getByText('A warehouse footprint needs at least three boundary points.'),
  ).toBeInTheDocument()
  expect(submitButton()).toBeDisabled()
})

test('rejects a blank warehouse name on the name field', async () => {
  const user = userEvent.setup()
  await startDrawing(user)

  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), '   ')
  await user.click(submitButton())

  expect(await screen.findByText('Warehouse name is required.')).toBeInTheDocument()
})

test('surfaces a duplicate-name conflict on the name field and keeps the drawing', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseConflictHandler())
  const router = await startDrawing(user)

  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), 'North Shed')
  await user.click(submitButton())

  expect(await screen.findByText('Warehouse name is already in use')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ create: 'warehouse' })
  expect(screen.getByTestId('pending-vertex-2')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Warehouse name' })).toHaveValue('North Shed')
})

test('surfaces a server-rejected outline as a form-level message', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseInvalidFootprintHandler())
  await startDrawing(user)

  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), 'Bow Tie')
  await user.click(submitButton())

  expect(
    await screen.findByText('Warehouse footprint outline must not cross itself'),
  ).toBeInTheDocument()
  expect(screen.getByTestId('pending-vertex-0')).toBeInTheDocument()
})

test('keeps the mode, the name, and every vertex after a server failure', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseFailureHandler())
  const router = await startDrawing(user)

  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), 'South Shed')
  await user.click(submitButton())

  await waitFor(() => expect(submitButton()).toBeEnabled())
  expect(router.state.location.search).toMatchObject({ create: 'warehouse' })
  expect(screen.getByRole('textbox', { name: 'Warehouse name' })).toHaveValue('South Shed')
  expect(screen.getByTestId('pending-vertex-2')).toBeInTheDocument()
})

test('reports an out-of-range coordinate on the affected boundary point', async () => {
  const user = userEvent.setup()
  await startDrawing(user)
  await user.click(screen.getByText('Coordinates (advanced)'))

  const firstPoint = screen.getByRole('group', { name: 'Boundary point 1' })
  const latitude = within(firstPoint).getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitude)
  await user.type(latitude, '91')

  expect(within(firstPoint).getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  expect(submitButton()).toBeDisabled()
})

test('blocks a self-crossing outline before it reaches the server', async () => {
  const user = userEvent.setup()
  await startDrawing(user, 4)
  await user.click(screen.getByText('Coordinates (advanced)'))

  // Points 1 and 2 run from (20.5, 10.5) to (21.5, 11.5); dropping points 3 and 4 onto either side
  // of that segment at longitude 21 makes the closing outline cross it.
  const moveTo = async (pointNumber: number, latitude: string, longitude: string) => {
    const group = screen.getByRole('group', { name: `Boundary point ${pointNumber}` })
    const latitudeField = within(group).getByRole('textbox', { name: 'Latitude' })
    await user.clear(latitudeField)
    await user.type(latitudeField, latitude)
    const longitudeField = within(group).getByRole('textbox', { name: 'Longitude' })
    await user.clear(longitudeField)
    await user.type(longitudeField, longitude)
  }

  await moveTo(3, '12', '21')
  await moveTo(4, '10', '21')

  expect(screen.getByText('The footprint outline must not cross itself.')).toBeInTheDocument()
  expect(submitButton()).toBeDisabled()
})
