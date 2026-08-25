import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { CREATED_WAREHOUSE, WAREHOUSE_ADMIN, WAREHOUSES } from '../support/fixtures'
import { createWarehouseHandler, warehousesHandler } from '../support/handlers'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function drawTriangle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create warehouse' }))
  for (let click = 0; click < 3; click += 1) {
    await user.click(
      screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
    )
  }
}

test('closes an open warehouse detail when the creation mode is activated', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
  await waitFor(() => expect(router.state.location.search).toHaveProperty('warehouseId'))

  await user.click(screen.getByRole('button', { name: 'Create warehouse' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('warehouseId'))
  expect(router.state.location.search).toMatchObject({ create: 'warehouse' })
})

test('creates a warehouse from the drawn footprint and reveals it as selected', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseHandler(CREATED_WAREHOUSE))
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  const { router } = renderWarehouses('/warehouses?status=archived&search=nothing-matches')

  await screen.findByRole('button', { name: 'Create warehouse' })
  await drawTriangle(user)

  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), 'South Shed')

  server.use(warehousesHandler([...WAREHOUSES, CREATED_WAREHOUSE]))
  await user.click(screen.getByRole('button', { name: 'Create warehouse', hidden: false }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(router.state.location.search).toMatchObject({
    search: '',
    status: 'available',
    warehouseId: CREATED_WAREHOUSE.id,
  })
  expect(
    await screen.findByRole('button', { name: 'View warehouse South Shed (Available)' }),
  ).toBeInTheDocument()
})

test('sends the drawn boundary points in the order they were placed', async () => {
  const user = userEvent.setup()
  const requests: Array<{ name: string; footprint: { points: unknown[] } }> = []
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST') {
      requests.push(await request.clone().json())
    }
  })
  server.use(createWarehouseHandler(CREATED_WAREHOUSE))
  renderWarehouses()

  await screen.findByRole('button', { name: 'Create warehouse' })
  await drawTriangle(user)
  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), 'South Shed')
  await user.click(screen.getByRole('button', { name: 'Create warehouse', hidden: false }))

  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0]).toEqual({
    name: 'South Shed',
    footprint: {
      points: [
        { latitude: 10.5, longitude: 20.5 },
        { latitude: 11.5, longitude: 21.5 },
        { latitude: 12.5, longitude: 20.5 },
      ],
    },
  })
})

test('discards every pending point and restores selection when creation is cancelled', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await screen.findByRole('button', { name: 'Create warehouse' })
  await drawTriangle(user)
  expect(screen.getByTestId('pending-vertex-2')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(screen.queryByTestId('pending-vertex-0')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }),
  ).toBeEnabled()
})

test('trims the submitted warehouse name', async () => {
  const user = userEvent.setup()
  const requests: Array<{ name: string }> = []
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST') {
      requests.push(await request.clone().json())
    }
  })
  server.use(createWarehouseHandler(CREATED_WAREHOUSE))
  renderWarehouses()

  await screen.findByRole('button', { name: 'Create warehouse' })
  await drawTriangle(user)
  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), '  South Shed  ')
  await user.click(screen.getByRole('button', { name: 'Create warehouse', hidden: false }))

  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0].name).toBe('South Shed')
})

test('creates a warehouse from coordinates typed without a pointing device', async () => {
  const user = userEvent.setup()
  server.use(createWarehouseHandler(CREATED_WAREHOUSE))
  const { router } = renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Create warehouse' }))
  await user.click(screen.getByText('Coordinates (advanced)'))

  for (const [latitude, longitude] of [
    ['10.5', '20.5'],
    ['11.5', '21.5'],
    ['12.5', '20.5'],
  ]) {
    await user.click(screen.getByRole('button', { name: 'Add boundary point' }))
    const group = screen.getAllByRole('group', { name: /Boundary point/ }).at(-1) as HTMLElement
    await user.type(within(group).getByRole('textbox', { name: 'Latitude' }), latitude)
    await user.type(within(group).getByRole('textbox', { name: 'Longitude' }), longitude)
  }

  await user.type(screen.getByRole('textbox', { name: 'Warehouse name' }), 'South Shed')
  await user.click(screen.getByRole('button', { name: 'Create warehouse', hidden: false }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
})
