import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN } from '../support/fixtures'
import { mockWarehouses, renderWarehouses } from '../support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function startDrawing(user: ReturnType<typeof userEvent.setup>) {
  const { router } = renderWarehouses()
  await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' })
  await user.click(screen.getByRole('button', { name: 'Create warehouse' }))
  await screen.findByRole('button', { name: 'Simulate map click to add footprint point' })
  return router
}

test('arms the map and appends a boundary point per click', async () => {
  const user = userEvent.setup()
  const router = await startDrawing(user)

  expect(router.state.location.search).toMatchObject({ create: 'warehouse' })
  expect(screen.getByRole('heading', { name: 'Create warehouse' })).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  expect(screen.getByTestId('pending-vertex-0')).toHaveTextContent('10.5, 20.5')

  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )

  expect(screen.getByTestId('pending-vertex-2')).toHaveTextContent('12.5, 20.5')
  expect(screen.getByRole('button', { name: 'Create warehouse', hidden: false })).toBeDefined()
})

test('does not select an existing warehouse while a footprint is being drawn', async () => {
  const user = userEvent.setup()
  const router = await startDrawing(user)

  expect(
    screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }),
  ).toBeDisabled()
  expect(router.state.location.search).not.toHaveProperty('warehouseId')
})

test('moves a boundary point when its marker is dragged', async () => {
  const user = userEvent.setup()
  await startDrawing(user)
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )

  await user.click(screen.getByRole('button', { name: 'Simulate dragging footprint point 1' }))

  expect(screen.getByTestId('pending-vertex-0')).toHaveTextContent('11.5, 21.5')
})

test('removes the most recently placed boundary point', async () => {
  const user = userEvent.setup()
  await startDrawing(user)
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )

  expect(screen.getByTestId('pending-vertex-1')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Remove last point' }))

  expect(screen.queryByTestId('pending-vertex-1')).not.toBeInTheDocument()
  expect(screen.getByTestId('pending-vertex-0')).toHaveTextContent('10.5, 20.5')
})

test('keeps the map and the coordinate fields in sync in both directions', async () => {
  const user = userEvent.setup()
  await startDrawing(user)
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )

  const firstPoint = screen.getByRole('group', { name: 'Boundary point 1' })
  expect(within(firstPoint).getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')

  await user.clear(within(firstPoint).getByRole('textbox', { name: 'Latitude' }))
  await user.type(within(firstPoint).getByRole('textbox', { name: 'Latitude' }), '30.25')

  expect(screen.getByTestId('pending-vertex-0')).toHaveTextContent('30.25, 20.5')
})

test('summarises the placed points instead of listing every coordinate', async () => {
  const user = userEvent.setup()
  await startDrawing(user)

  expect(screen.getByText('No points placed yet')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Boundary point 1' })).not.toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  expect(screen.getByText('1 point placed')).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  expect(screen.getByText('2 points placed')).toBeInTheDocument()

  // The coordinates stay reachable, just not in the way.
  await user.click(screen.getByText('Coordinates (advanced)'))
  expect(screen.getByRole('group', { name: 'Boundary point 1' })).toBeInTheDocument()
})

test('finishes the outline when the first boundary point is clicked', async () => {
  const user = userEvent.setup()
  await startDrawing(user)

  for (let click = 0; click < 3; click += 1) {
    await user.click(
      screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
    )
  }

  await user.click(
    screen.getByRole('button', { name: 'Simulate clicking the first footprint point' }),
  )

  // The map stops taking new points, so a stray click can no longer reshape a finished outline.
  expect(
    screen.queryByRole('button', { name: 'Simulate map click to add footprint point' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('3 points placed · outline finished')).toBeInTheDocument()
})

test('keeps boundary points draggable after the outline is finished', async () => {
  const user = userEvent.setup()
  await startDrawing(user)

  for (let click = 0; click < 3; click += 1) {
    await user.click(
      screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
    )
  }
  await user.click(
    screen.getByRole('button', { name: 'Simulate clicking the first footprint point' }),
  )

  await user.click(screen.getByRole('button', { name: 'Simulate dragging footprint point 1' }))

  expect(screen.getByTestId('pending-vertex-0')).toHaveTextContent('11.5, 21.5')
})

test('does not offer to finish an outline that has fewer than three points', async () => {
  const user = userEvent.setup()
  await startDrawing(user)
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )

  expect(
    screen.queryByRole('button', { name: 'Simulate clicking the first footprint point' }),
  ).not.toBeInTheDocument()
})
