import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { footprintCentre, formatCoordinates } from '@/features/warehouses/geometry/footprint-centre'
import { WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const centre = formatCoordinates(footprintCentre(NORTH_SHED.footprint.points))

async function openNorthShed(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${NORTH_SHED.name} (Available)` }),
  )

  return screen.findByRole('complementary', { name: NORTH_SHED.name })
}

test('opens a card beside the selected warehouse with its footprint and doors', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  const card = await openNorthShed(user)

  expect(within(card).getByText('Warehouse · Available')).toBeInTheDocument()
  expect(card).toHaveTextContent(`3 boundary points · centre ${centre}`)
  expect(within(card).getByRole('heading', { name: NORTH_SHED.name })).toHaveFocus()

  const doorFilter = within(card).getByRole('group', { name: 'Door status' })
  expect(within(doorFilter).getByRole('button', { name: 'Available, 1 doors' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(doorFilter).getByRole('button', { name: 'Archived, 1 doors' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(card).toHaveTextContent('48.8550, 2.3450')
  expect(card).toHaveTextContent('Select a door to highlight its unloading point on the map.')
  expect(card).toHaveTextContent(/^.*Updated .* · created .*$/)
})

test('switches the card to the archived doors', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  const card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: 'Archived, 1 doors' }))

  expect(router.state.location.search).toMatchObject({ doorStatus: 'archived' })
  expect(await within(card).findByText('Old Door')).toBeInTheDocument()
})

test('highlights a door picked in the card', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  const card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: /^North Door/ }))

  expect(router.state.location.search).toMatchObject({ doorId: NORTH_SHED.doors?.[0].id })
})

test('copies the centre coordinates', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  // After `setup()`, which installs its own clipboard stub.
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  renderWarehouses()

  const card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: 'Copy centre coordinates' }))

  expect(writeText).toHaveBeenCalledWith(centre)
  expect(await screen.findByText('Coordinates copied')).toBeInTheDocument()
})

test('closes the card with its Close button and with Escape', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  let card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('warehouseId'))
  expect(screen.queryByRole('complementary', { name: NORTH_SHED.name })).not.toBeInTheDocument()

  card = await openNorthShed(user)
  await user.keyboard('{Escape}')

  await waitFor(() =>
    expect(screen.queryByRole('complementary', { name: NORTH_SHED.name })).not.toBeInTheDocument(),
  )
})
