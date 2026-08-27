import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  WAREHOUSE_ADMIN,
  WAREHOUSE_OBSERVER,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const AVAILABLE = WAREHOUSES[0]
const ARCHIVED_WAREHOUSE = WAREHOUSES[1]
const DOOR = (AVAILABLE.doors ?? [])[0]
const ARCHIVED_DOOR_ROW = (AVAILABLE.doors ?? [])[1]

const path = (search = '') => `/warehouses?status=all&warehouseId=${AVAILABLE.id}${search}`

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

test('offers a checkbox on every available door row as soon as the warehouse opens', async () => {
  renderWarehouses(path())

  // No mode to enter: opening an available warehouse is the whole gesture.
  expect(
    await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select all available doors' })).toBeInTheDocument()
})

test('offers no checkbox to a non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(path())

  expect(await screen.findByText(DOOR.name)).toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).not.toBeInTheDocument()
})

test('offers no checkbox on an archived warehouse, whose doors are all archived already', async () => {
  renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED_WAREHOUSE.id}`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('offers no checkbox for an archived door', async () => {
  renderWarehouses(path())

  await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` })
  expect(
    screen.queryByRole('checkbox', { name: `Select door ${ARCHIVED_DOOR_ROW.name}` }),
  ).not.toBeInTheDocument()
})

test('checks a door from the list and mirrors it on the map, and back', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))

  const marker = await screen.findByRole('button', { name: `Deselect door ${DOOR.name}` })
  expect(marker).toHaveAttribute('aria-pressed', 'true')

  await user.click(marker)

  expect(
    await screen.findByRole('button', { name: `Select door ${DOOR.name}` }),
  ).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).not.toBeChecked()
})

test('a marker click checks the door and highlights it in the same gesture', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(path())

  await user.click(await screen.findByRole('button', { name: `Select door ${DOOR.name}` }))

  // Checked…
  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).toBeChecked()
  // …and highlighted, which is what tells the administrator which door they just checked.
  await waitFor(() => expect(router.state.location.search.doorId).toBe(DOOR.id))
})

test('selects every listed available door at once', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: 'Select all available doors' }))

  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('empties the selection when the archived door view is opened', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Archived/ }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})

test('does not resurrect the selection when the Available view is reopened', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(screen.getByRole('tab', { name: /Archived/ }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Available/ }))

  expect(
    await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).not.toBeChecked()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('withdraws the selection while a door creation session owns the panel', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(screen.getByRole('button', { name: 'Create door' }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})

test('leaves the other warehouses selectable while no door is checked', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(path())

  // Checking doors is offered on every open available warehouse, so it must cost nothing until a
  // door is actually checked: switching warehouse is the ordinary gesture, not an escape from a
  // mode.
  const other = await screen.findByRole('button', {
    name: `View warehouse ${ARCHIVED_WAREHOUSE.name} (Archived)`,
  })
  expect(other).toBeEnabled()

  await user.click(other)

  await waitFor(() => expect(router.state.location.search.warehouseId).toBe(ARCHIVED_WAREHOUSE.id))
})


test('stops a polygon click moving the warehouse under a selection in progress', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))

  expect(
    screen.getByRole('button', { name: `View warehouse ${ARCHIVED_WAREHOUSE.name} (Archived)` }),
  ).toBeDisabled()
})


test('counts the selection and clears it in one gesture', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  expect(await screen.findByText('1 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).not.toBeChecked()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
})

