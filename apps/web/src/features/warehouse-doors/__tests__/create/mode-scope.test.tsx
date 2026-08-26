import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { BULK_WAREHOUSES, WAREHOUSE_ADMIN } from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const NORTH = BULK_WAREHOUSES[0]
const EAST = BULK_WAREHOUSES[1]
const ARCHIVED = BULK_WAREHOUSES[3]

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN, BULK_WAREHOUSES)
})

async function openDoorCreation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` }),
  )
  await user.click(await screen.findByRole('button', { name: 'Create door' }))
  await screen.findByRole('heading', { name: 'Create door' })
}

async function selectEastShed(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${EAST.name} (Available)` }),
  )
}

/** The mode belongs to the warehouse it was opened for. Every way of leaving that warehouse behind
 * has to take the mode with it, or the next warehouse opened — by this administrator or by whoever
 * they hand the URL to — silently arms door creation instead of showing its doors. */
test('drops the mode when the lifecycle filter clears the selection', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openDoorCreation(user)

  await user.click(screen.getByRole('button', { name: /Filter warehouses/ }))
  await user.click(await screen.findByRole('menuitemradio', { name: /^Available/ }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))

  await selectEastShed(user)

  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
})

test('drops the mode when select mode clears the selection', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openDoorCreation(user)

  await user.click(screen.getByRole('button', { name: 'Select warehouses' }))
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))

  await user.click(screen.getByRole('button', { name: 'Stop selecting warehouses' }))
  await selectEastShed(user)

  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
})

test('drops a mode carried in on a URL that names no warehouse', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses('/warehouses?status=all&create=door')

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))

  await selectEastShed(user)

  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
})

/** An archived warehouse takes no new door, so the mode is inert on one — but left in the URL it
 * would arm placement the moment that warehouse is reactivated (#211), an action the administrator
 * never asked for. The param goes as soon as the selection turns out to be archived. */
test('drops a mode carried in on a URL naming an archived warehouse', async () => {
  const { router } = renderWarehouses(
    `/warehouses?status=all&warehouseId=${ARCHIVED.id}&create=door`,
  )

  expect(await screen.findByRole('heading', { name: 'Doors' })).toBeInTheDocument()
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(screen.queryByRole('heading', { name: 'Create door' })).not.toBeInTheDocument()
})

/** A drawing in progress owns the map rather than a selection, so the same navigations must leave
 * `create=warehouse` alone — clearing it would discard the outline under the administrator. */
test('keeps a footprint drawing armed across the same navigations', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Create warehouse' }))
  await screen.findByRole('heading', { name: 'Create warehouse' })

  await user.click(screen.getByRole('button', { name: /Filter warehouses/ }))
  await user.click(await screen.findByRole('menuitemradio', { name: /^Available/ }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ status: 'available' }))
  expect(router.state.location.search).toMatchObject({ create: 'warehouse' })
  expect(screen.getByRole('heading', { name: 'Create warehouse' })).toBeInTheDocument()
})
