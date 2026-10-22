import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WAREHOUSE_OBSERVER, WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const statusFilter = () => screen.findByRole('group', { name: 'Filter by warehouse status' })

test('opens on the Available pill with a count for each status', async () => {
  mockWarehouses()
  renderWarehouses('/warehouses?status=available')

  const filter = await statusFilter()
  const available = within(filter).getByRole('button', { name: 'Available, 1 warehouses' })
  const archived = within(filter).getByRole('button', { name: 'Archived, 1 warehouses' })

  expect(available).toHaveAttribute('aria-pressed', 'true')
  // The last pressed pill cannot be released: a filter emptied of statuses would show nothing.
  expect(available).toBeDisabled()
  expect(archived).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('combobox', { name: 'Search warehouses' })).toBeInTheDocument()
})

test('adds and removes archived warehouses with the pills', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses('/warehouses?status=available')

  const filter = await statusFilter()
  await user.click(within(filter).getByRole('button', { name: /^Archived/ }))

  expect(router.state.location.search).toMatchObject({ status: 'all' })
  expect(
    await screen.findByRole('button', { name: `View warehouse ${WAREHOUSES[1].name} (Archived)` }),
  ).toBeInTheDocument()

  await user.click(within(filter).getByRole('button', { name: /^Available/ }))

  expect(router.state.location.search).toMatchObject({ status: 'archived' })
  expect(within(filter).getByRole('button', { name: /^Archived/ })).toBeDisabled()
})

test('keeps the legend and map controls on screen', async () => {
  mockWarehouses()
  renderWarehouses()

  const legend = await screen.findByRole('region', { name: 'Warehouse legend' })

  expect(within(legend).getByText('Warehouse')).toBeInTheDocument()
  expect(within(legend).getByText('Door')).toBeInTheDocument()
  expect(within(legend).getByText('Archived')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Fit all warehouses' })).toBeInTheDocument()
})

test('offers Create warehouse in the toolbar to an administrator only', async () => {
  mockWarehouses()
  renderWarehouses()

  expect(await screen.findByRole('button', { name: 'Create warehouse' })).toBeInTheDocument()
})

test('offers no management action to a non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?warehouseId=${WAREHOUSES[0].id}`)

  const card = await screen.findByRole('complementary', { name: WAREHOUSES[0].name })

  expect(screen.queryByRole('button', { name: 'Create warehouse' })).not.toBeInTheDocument()
  for (const name of ['Create door', 'Edit', 'Archive', 'Reactivate']) {
    expect(within(card).queryByRole('button', { name })).not.toBeInTheDocument()
  }

  await user.click(within(card).getByRole('button', { name: 'Actions for North Door' }))

  expect(await screen.findByRole('menuitem', { name: 'Show on map' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Copy coordinates' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
})
