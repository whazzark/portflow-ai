import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BULK_WAREHOUSES, WAREHOUSE_OBSERVER } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH = BULK_WAREHOUSES[0]
const EAST = BULK_WAREHOUSES[1]
const RETIRED = BULK_WAREHOUSES[3]

test('hides the bulk action bar until at least one warehouse is checked', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Select warehouses' }))
  await user.click(await screen.findByRole('button', { name: `Select warehouse ${NORTH.name}` }))

  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

// Reactivation (GH-211) made an archived warehouse checkable, because a selection may now be for
// either direction. What replaced the old "archived is never checkable" rule is that a selection
// commits to one intent as soon as anything is checked — asserted below and in selection-scope.
test('offers a checkbox for an archived warehouse so a reactivation can start', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))

  expect(
    await screen.findByRole('button', { name: `Select warehouse ${RETIRED.name}` }),
  ).toBeInTheDocument()
})

test('stops offering available warehouses once an archived one is checked', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  await user.click(await screen.findByRole('button', { name: `Select warehouse ${RETIRED.name}` }))

  expect(
    screen.queryByRole('button', { name: `Select warehouse ${BULK_WAREHOUSES[0].name}` }),
  ).not.toBeInTheDocument()
})

test('toggles a warehouse off and clears the whole selection', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  await user.click(await screen.findByRole('button', { name: `Select warehouse ${NORTH.name}` }))
  await user.click(screen.getByRole('button', { name: `Select warehouse ${EAST.name}` }))
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: `Deselect warehouse ${EAST.name}` }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear selection' }))
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('leaving select mode drops the selection', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  await user.click(await screen.findByRole('button', { name: `Select warehouse ${NORTH.name}` }))
  await user.click(screen.getByRole('button', { name: 'Stop selecting warehouses' }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` }),
  ).toBeInTheDocument()
})

test('offers no select mode to an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER, BULK_WAREHOUSES)
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })

  expect(screen.queryByRole('button', { name: 'Select warehouses' })).not.toBeInTheDocument()
})

test('ignores a selecting URL for an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER, BULK_WAREHOUSES)
  renderWarehouses('/warehouses?status=all&selecting=warehouses')

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select warehouse ${NORTH.name}` }),
  ).not.toBeInTheDocument()
})
