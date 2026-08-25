import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BULK_WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH = BULK_WAREHOUSES[0]
const EAST = BULK_WAREHOUSES[1]
const ARCHIVED = BULK_WAREHOUSES[3]

async function checkWarehouses(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))
  for (const name of names) {
    await user.click(await screen.findByRole('button', { name: `Select warehouse ${name}` }))
  }
}

test('a search term narrows what is displayed without pruning the selection', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name)
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Search warehouses' }), EAST.name)

  // North Shed is no longer emphasised by the search, but it remains chosen.
  expect(await screen.findByText('2 selected')).toBeInTheDocument()
})

test('switching to the archived view drops warehouses no longer listed', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await checkWarehouses(user, NORTH.name, EAST.name)
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Filter warehouses/ }))
  await user.click(await screen.findByRole('menuitemradio', { name: /^Archived/ }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('never offers a warehouse outside the current status scope', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses('/warehouses?status=available')

  await user.click(await screen.findByRole('button', { name: 'Select warehouses' }))

  // Only the three available warehouses are checkable; the archived one is not even listed.
  expect(screen.getAllByRole('button', { name: /^Select warehouse / })).toHaveLength(3)
  expect(
    screen.queryByRole('button', { name: `Select warehouse ${ARCHIVED.name}` }),
  ).not.toBeInTheDocument()
})
