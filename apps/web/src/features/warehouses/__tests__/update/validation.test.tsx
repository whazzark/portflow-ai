import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { WAREHOUSE_ADMIN, WAREHOUSES } from '../support/fixtures'
import {
  updateWarehouseConflictHandler,
  updateWarehouseDoorsOutsideHandler,
  updateWarehouseFailureHandler,
} from '../support/handlers'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function openUpdate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
}

const nameField = () => screen.getByRole('textbox', { name: 'Warehouse name' })

test('rejects a blank name on the name field and stores nothing', async () => {
  const user = userEvent.setup()
  const requests: string[] = []
  server.events.on('request:start', ({ request }) => requests.push(request.method))
  renderWarehouses()

  await openUpdate(user)
  await user.clear(nameField())
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Warehouse name is required.')).toBeInTheDocument()
  expect(requests).not.toContain('PATCH')
})

test('surfaces a duplicate name on the name field and keeps the draft', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseConflictHandler(NORTH_SHED.id))
  const { router } = renderWarehouses()

  await openUpdate(user)
  await user.clear(nameField())
  await user.type(nameField(), 'Retired Shed')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Warehouse name is already in use')).toBeInTheDocument()
  expect(nameField()).toHaveValue('Retired Shed')
  expect(screen.getByTestId('boundary-point-0')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ edit: 'warehouse' })
})

test('surfaces the API door refusal and keeps the draft', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseDoorsOutsideHandler(NORTH_SHED.id, ['North Door']))
  const { router } = renderWarehouses()

  await openUpdate(user)
  // A change the client guard accepts, so the refusal can only come from the API — which stays the
  // enforcement point whatever the panel decided to let through.
  await user.clear(nameField())
  await user.type(nameField(), 'Renamed Shed')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('Doors North Door would fall outside the new footprint'),
  ).toBeInTheDocument()
  expect(screen.getByTestId('boundary-point-0')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ edit: 'warehouse' })
})

test('blocks a save whose outline no longer encloses an area, before any request', async () => {
  const user = userEvent.setup()
  const requests: string[] = []
  server.events.on('request:start', ({ request }) => requests.push(request.method))
  renderWarehouses()

  await openUpdate(user)
  // Dragging every point by the same offset keeps the shape, so flatten it through the
  // coordinates instead: three points on one line enclose nothing.
  await user.click(screen.getByText('Coordinates (advanced)'))
  for (const index of [1, 2, 3]) {
    const point = screen.getByRole('group', { name: `Boundary point ${index}` })
    const latitude = within(point).getByRole('textbox', { name: 'Latitude' })
    const longitude = within(point).getByRole('textbox', { name: 'Longitude' })
    await user.clear(latitude)
    await user.type(latitude, '10')
    await user.clear(longitude)
    await user.type(longitude, String(10 + index))
  }

  expect(
    await screen.findByText(
      'The boundary points are all in line, so the outline encloses no area.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(requests).not.toContain('PATCH')
})

test('disables every removal at three boundary points and explains why', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)
  await user.click(screen.getByText('Coordinates (advanced)'))

  for (const index of [1, 2, 3]) {
    expect(screen.getByRole('button', { name: `Remove point ${index}` })).toBeDisabled()
  }
  expect(
    screen.getByText('A warehouse footprint must keep at least three boundary points.'),
  ).toBeInTheDocument()
})

test('keeps the draft and the mode after a retryable failure', async () => {
  const user = userEvent.setup()
  server.use(updateWarehouseFailureHandler(NORTH_SHED.id))
  const { router } = renderWarehouses()

  await openUpdate(user)
  await user.clear(nameField())
  await user.type(nameField(), 'Renamed Shed')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(nameField()).toHaveValue('Renamed Shed'))
  expect(screen.getByTestId('boundary-point-0')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ edit: 'warehouse' })
})

test('names the doors a reshape would exclude before any request is sent', async () => {
  const user = userEvent.setup()
  const requests: string[] = []
  server.events.on('request:start', ({ request }) => requests.push(request.method))
  renderWarehouses()

  await openUpdate(user)
  // Move the whole outline far away from the doors, which stay where they are recorded.
  await user.click(screen.getByText('Coordinates (advanced)'))
  for (const index of [1, 2, 3]) {
    const point = screen.getByRole('group', { name: `Boundary point ${index}` })
    const latitude = within(point).getByRole('textbox', { name: 'Latitude' })
    const longitude = within(point).getByRole('textbox', { name: 'Longitude' })
    await user.clear(latitude)
    await user.type(latitude, String(10 + index))
    await user.clear(longitude)
    await user.type(longitude, String(20 + index * index))
  }

  // North Shed's two doors — one available, one archived — both fall outside now.
  expect(
    await screen.findByText(
      'Doors North Door, Old Door would fall outside the footprint. Adjust the outline around them.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(requests).not.toContain('PATCH')
})
