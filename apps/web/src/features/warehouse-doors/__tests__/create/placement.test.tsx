import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN, WAREHOUSES } from '@/features/warehouses/__tests__/support/fixtures'
import { MOCK_DOOR_CLICK_POINTS } from '@/features/warehouses/__tests__/support/mock-warehouse-map'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

const AVAILABLE_WAREHOUSE = WAREHOUSES[0]

async function openDoorCreation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
  await user.click(await screen.findByRole('button', { name: 'Create door' }))
}

test('activates the mode for the selected warehouse without losing it', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openDoorCreation(user)

  await waitFor(() => expect(router.state.location.search).toMatchObject({ create: 'door' }))
  expect(router.state.location.search).toMatchObject({ warehouseId: AVAILABLE_WAREHOUSE.id })
  expect(await screen.findByRole('heading', { name: 'Create door' })).toBeInTheDocument()
})

test('places one pending door on a map click and moves it on the next', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openDoorCreation(user)
  await user.click(
    await screen.findByRole('button', { name: 'Simulate map click to place the door' }),
  )

  const pending = await screen.findByTestId('pending-door')
  expect(pending).toHaveTextContent(
    `${MOCK_DOOR_CLICK_POINTS[0].latitude}, ${MOCK_DOOR_CLICK_POINTS[0].longitude}`,
  )
  expect(screen.getByText('New door')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Simulate map click to place the door' }))

  expect(screen.getAllByTestId('pending-door')).toHaveLength(1)
  expect(screen.getByTestId('pending-door')).toHaveTextContent(
    `${MOCK_DOOR_CLICK_POINTS[1].latitude}, ${MOCK_DOOR_CLICK_POINTS[1].longitude}`,
  )
})

test('keeps the coordinate fields in step with the pending door in both directions', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openDoorCreation(user)
  await user.click(
    await screen.findByRole('button', { name: 'Simulate map click to place the door' }),
  )

  const latitude = screen.getByRole('textbox', { name: 'Latitude' })
  const longitude = screen.getByRole('textbox', { name: 'Longitude' })
  expect(latitude).toHaveValue(String(MOCK_DOOR_CLICK_POINTS[0].latitude))
  expect(longitude).toHaveValue(String(MOCK_DOOR_CLICK_POINTS[0].longitude))

  await user.click(screen.getByRole('button', { name: 'Simulate dragging the pending door' }))

  expect(latitude).toHaveValue(String(MOCK_DOOR_CLICK_POINTS[0].latitude + 0.0005))

  await user.clear(latitude)
  await user.type(latitude, '48.8535')

  await waitFor(() =>
    expect(screen.getByTestId('pending-door')).toHaveTextContent('48.8535, 2.3505'),
  )
})

test('places the door without a pointing device from the coordinate fields alone', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openDoorCreation(user)

  await user.type(screen.getByRole('textbox', { name: 'Latitude' }), '48.853')
  await user.type(screen.getByRole('textbox', { name: 'Longitude' }), '2.35')

  expect(await screen.findByTestId('pending-door')).toHaveTextContent('48.853, 2.35')
})

test('map clicks place the door instead of selecting a warehouse', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openDoorCreation(user)

  expect(
    screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }),
  ).toBeDisabled()
})

// An existing door is the likeliest neighbour of a new one, so its marker must not become a hole
// the placement click falls into: the marker stops taking pointer events rather than merely
// refusing to select, and the click carries on to the map underneath.
test('a click over an existing door places the pending door rather than selecting it', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openDoorCreation(user)
  await user.click(await screen.findByRole('button', { name: 'North Door door marker' }))

  expect(await screen.findByTestId('pending-door')).toHaveTextContent(
    `${MOCK_DOOR_CLICK_POINTS[0].latitude}, ${MOCK_DOOR_CLICK_POINTS[0].longitude}`,
  )
  expect(screen.getByRole('heading', { name: 'Create door' })).toBeInTheDocument()
})

test('discards the pending door when the mode is cancelled', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openDoorCreation(user)
  await user.click(
    await screen.findByRole('button', { name: 'Simulate map click to place the door' }),
  )
  await screen.findByTestId('pending-door')

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(screen.queryByTestId('pending-door')).not.toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: 'Create door' }))

  expect(screen.queryByTestId('pending-door')).not.toBeInTheDocument()
})

// Cancelling is not the only way back into the mode: the browser's Back button returns to the very
// URL the administrator cancelled out of, and the point they discarded must not come back with it.
test('does not restore the discarded pending door when the browser returns to the mode', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openDoorCreation(user)
  await user.click(
    await screen.findByRole('button', { name: 'Simulate map click to place the door' }),
  )
  await screen.findByTestId('pending-door')

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))

  await act(async () => router.history.back())

  await waitFor(() => expect(router.state.location.search).toMatchObject({ create: 'door' }))
  expect(await screen.findByRole('heading', { name: 'Create door' })).toBeInTheDocument()
  expect(screen.queryByTestId('pending-door')).not.toBeInTheDocument()
})

// A new door is always Available, so placement runs in the Available view whatever the
// administrator was consulting: the archived view would hide the very doors they are placing the
// new one between.
test('places from the Available view even when the archived doors were on screen', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
  await user.click(await screen.findByRole('tab', { name: /Archived/ }))
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ doorStatus: 'archived' }),
  )

  await user.click(screen.getByRole('button', { name: 'Create door' }))

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ doorStatus: 'available' }),
  )
  expect(await screen.findByRole('button', { name: 'North Door door marker' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Old Door door marker' })).not.toBeInTheDocument()
})
