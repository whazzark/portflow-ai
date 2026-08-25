import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN, WAREHOUSES } from '../support/fixtures'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const STORED = NORTH_SHED.footprint.points

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function openUpdate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
}

const pointAt = (index: number) => screen.getByTestId(`boundary-point-${index}`).textContent

test('moves a boundary point without changing the count', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)
  await user.click(screen.getByRole('button', { name: 'Simulate dragging boundary point 2' }))

  expect(pointAt(1)).toBe(`${STORED[1].latitude + 1}, ${STORED[1].longitude + 1}`)
  expect(screen.getByText('3 boundary points')).toBeInTheDocument()
  expect(screen.queryByTestId('boundary-point-3')).not.toBeInTheDocument()
})

test('inserts a boundary point between the designated edge endpoints and nowhere else', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)
  // Edge 1 runs from boundary point 1 to boundary point 2.
  await user.click(screen.getByRole('button', { name: 'Simulate inserting on edge 1' }))

  expect(screen.getByText('4 boundary points')).toBeInTheDocument()
  expect(pointAt(0)).toBe(`${STORED[0].latitude}, ${STORED[0].longitude}`)
  expect(pointAt(1)).toBe(
    `${(STORED[0].latitude + STORED[1].latitude) / 2}, ${(STORED[0].longitude + STORED[1].longitude) / 2}`,
  )
  expect(pointAt(2)).toBe(`${STORED[1].latitude}, ${STORED[1].longitude}`)
  expect(pointAt(3)).toBe(`${STORED[2].latitude}, ${STORED[2].longitude}`)
})

test('removes a boundary point that is not the last one added', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)
  await user.click(screen.getByRole('button', { name: 'Simulate inserting on edge 3' }))
  expect(screen.getByText('4 boundary points')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Simulate removing boundary point 1' }))

  expect(screen.getByText('3 boundary points')).toBeInTheDocument()
  expect(pointAt(0)).toBe(`${STORED[1].latitude}, ${STORED[1].longitude}`)
  expect(pointAt(1)).toBe(`${STORED[2].latitude}, ${STORED[2].longitude}`)
})

test('refuses to take the outline below three boundary points', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)

  for (const index of [1, 2, 3]) {
    expect(
      screen.getByRole('button', { name: `Simulate removing boundary point ${index}` }),
    ).toBeDisabled()
  }
  expect(screen.getByText('3 boundary points')).toBeInTheDocument()
})

test('leaves the outline alone when a click lands away from it', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)
  const before = [pointAt(0), pointAt(1), pointAt(2)]

  await user.click(screen.getByRole('button', { name: 'Simulate map click away from the outline' }))

  expect([pointAt(0), pointAt(1), pointAt(2)]).toEqual(before)
  expect(screen.getByText('3 boundary points')).toBeInTheDocument()
})

test('does not let another warehouse be selected while an outline is being corrected', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openUpdate(user)

  expect(
    screen.getByRole('button', { name: 'View warehouse Retired Shed (Archived)' }),
  ).toBeDisabled()
  await waitFor(() => expect(router.state.location.search).toMatchObject({ edit: 'warehouse' }))
})

test('offers no way to finish an outline that is already closed', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  await openUpdate(user)

  expect(
    screen.queryByRole('button', { name: 'Simulate clicking the first footprint point' }),
  ).not.toBeInTheDocument()
})
