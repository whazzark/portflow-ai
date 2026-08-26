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

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function openUpdate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'View warehouse North Shed (Available)' }),
  )
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
}

test('opens the update mode pre-filled with the stored name and every boundary point', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openUpdate(user)

  await waitFor(() => expect(router.state.location.search).toMatchObject({ edit: 'warehouse' }))
  expect(router.state.location.search).toMatchObject({ warehouseId: NORTH_SHED.id })
  // The panel is titled like every other edit panel, and the way back out is worded like theirs.
  expect(screen.getByRole('heading', { name: 'Edit warehouse' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Back to details' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Warehouse name' })).toHaveValue(NORTH_SHED.name)

  for (const [index, point] of NORTH_SHED.footprint.points.entries()) {
    expect(screen.getByTestId(`boundary-point-${index}`)).toHaveTextContent(
      `${point.latitude}, ${point.longitude}`,
    )
  }
})

test('leaves the update mode without saving when creation is activated', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openUpdate(user)
  await user.click(screen.getByRole('button', { name: 'Create warehouse' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(router.state.location.search).toMatchObject({ create: 'warehouse' })
  expect(screen.queryByTestId('boundary-point-0')).not.toBeInTheDocument()
})

test('drops any pending creation footprint when the update mode is activated', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await screen.findByRole('button', { name: 'Create warehouse' })
  await user.click(screen.getByRole('button', { name: 'Create warehouse' }))
  await user.click(
    screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
  )
  expect(screen.getByTestId('pending-vertex-0')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await openUpdate(user)

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(screen.queryByTestId('pending-vertex-0')).not.toBeInTheDocument()
})

test('restores the stored outline and keeps the warehouse selected when cancelled', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openUpdate(user)
  await user.click(screen.getByRole('button', { name: 'Simulate dragging boundary point 1' }))
  expect(screen.getByTestId('boundary-point-0')).not.toHaveTextContent(
    `${NORTH_SHED.footprint.points[0].latitude}, ${NORTH_SHED.footprint.points[0].longitude}`,
  )

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(router.state.location.search).toMatchObject({ warehouseId: NORTH_SHED.id })
  expect(screen.queryByTestId('boundary-point-0')).not.toBeInTheDocument()

  // Reopening starts from the stored outline, not from the abandoned draft.
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(screen.getByTestId('boundary-point-0')).toHaveTextContent(
    `${NORTH_SHED.footprint.points[0].latitude}, ${NORTH_SHED.footprint.points[0].longitude}`,
  )
})

test('discards the session when the selection it belongs to goes away', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await openUpdate(user)
  await waitFor(() => expect(router.state.location.search).toMatchObject({ edit: 'warehouse' }))

  await router.navigate({ to: '/warehouses', search: { search: '', status: 'all' } })

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('edit'))
  expect(screen.queryByRole('textbox', { name: 'Warehouse name' })).not.toBeInTheDocument()
})
