import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { server } from '@/test/msw/server'
import {
  DOORLESS_WAREHOUSE,
  UPDATED_WAREHOUSE,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
} from '../support/fixtures'
import { updateWarehouseHandler, warehousesHandler } from '../support/handlers'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]

/** The PATCH bodies as they left the browser, so the wire contract is asserted, not assumed. */
function capturePatches() {
  const patches: Array<{ url: string; body: Promise<unknown> }> = []

  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PATCH') {
      patches.push({ url: request.url, body: request.clone().json() })
    }
  })

  return patches
}

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

afterEach(() => {
  server.events.removeAllListeners()
})

async function openUpdate(user: ReturnType<typeof userEvent.setup>, name = NORTH_SHED.name) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${name} (Available)` }),
  )
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
}

const nameField = () => screen.getByRole('textbox', { name: 'Warehouse name' })

test('submits the name and the whole outline, then returns to the warehouse details', async () => {
  const user = userEvent.setup()
  const patches = capturePatches()
  server.use(updateWarehouseHandler(UPDATED_WAREHOUSE))
  const { router } = renderWarehouses()

  await openUpdate(user)
  // The session is open, so the list may now answer with the corrected warehouse: what the panel
  // submits is the snapshot it opened on, not whatever a later refetch brings back.
  server.use(warehousesHandler([UPDATED_WAREHOUSE, WAREHOUSES[1]]))
  await user.clear(nameField())
  await user.type(nameField(), UPDATED_WAREHOUSE.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(patches).toHaveLength(1))
  expect(patches[0].url).toContain(`/api/v1/warehouses/${NORTH_SHED.id}`)
  // A footprint travels as the complete resulting ring, nested under `footprint`.
  expect(await patches[0].body).toEqual({
    name: UPDATED_WAREHOUSE.name,
    footprint: { points: NORTH_SHED.footprint.points },
  })

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(router.state.location.search).toMatchObject({ warehouseId: NORTH_SHED.id })
  expect(screen.queryByRole('textbox', { name: 'Warehouse name' })).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(await screen.findByText(UPDATED_WAREHOUSE.name)).toBeInTheDocument()
})

test('submits a reshaped outline in the corrected order', async () => {
  const user = userEvent.setup()
  const patches = capturePatches()
  const reshaped: WarehouseWithDoorsDto = {
    ...DOORLESS_WAREHOUSE,
    footprint: {
      points: DOORLESS_WAREHOUSE.footprint.points.map((point, index) =>
        index === 1 ? { latitude: point.latitude + 1, longitude: point.longitude + 1 } : point,
      ),
    },
  }
  mockWarehouses(WAREHOUSE_ADMIN, [DOORLESS_WAREHOUSE])
  server.use(updateWarehouseHandler(reshaped))
  renderWarehouses()

  await openUpdate(user, DOORLESS_WAREHOUSE.name)
  await user.click(screen.getByRole('button', { name: 'Simulate dragging boundary point 2' }))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(patches).toHaveLength(1))
  expect(await patches[0].body).toEqual({
    name: DOORLESS_WAREHOUSE.name,
    footprint: { points: reshaped.footprint.points },
  })
})

test('keeps the active search when the corrected name still matches it', async () => {
  const user = userEvent.setup()
  const renamed: WarehouseWithDoorsDto = { ...NORTH_SHED, name: 'Nôrth Shed' }
  server.use(updateWarehouseHandler(renamed))
  const { router } = renderWarehouses('/warehouses?search=north')

  await openUpdate(user)
  server.use(warehousesHandler([renamed, WAREHOUSES[1]]))
  await user.clear(nameField())
  await user.type(nameField(), renamed.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  // The list matcher ignores accents, so the filter the administrator set survives the rename.
  expect(router.state.location.search).toMatchObject({ search: 'north' })
})

test('clears the active search when the corrected name no longer matches it', async () => {
  const user = userEvent.setup()
  const renamed: WarehouseWithDoorsDto = { ...NORTH_SHED, name: 'Renamed Shed' }
  server.use(updateWarehouseHandler(renamed))
  const { router } = renderWarehouses('/warehouses?search=north')

  await openUpdate(user)
  server.use(warehousesHandler([renamed, WAREHOUSES[1]]))
  await user.clear(nameField())
  await user.type(nameField(), renamed.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ search: '' }))
  expect(router.state.location.search).toMatchObject({ warehouseId: NORTH_SHED.id })
})
