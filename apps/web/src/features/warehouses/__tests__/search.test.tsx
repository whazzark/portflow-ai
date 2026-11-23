import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const NORTH_DOOR = NORTH_SHED.doors?.[0]

test('groups matching warehouses and doors', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses('/warehouses?status=available')

  await user.type(await screen.findByRole('combobox', { name: 'Search warehouses' }), 'north')

  const results = await screen.findByRole('listbox', { name: 'Search results' })
  const [warehouses, doors] = within(results).getAllByRole('group')

  expect(warehouses).toHaveTextContent('Warehouses1')
  expect(within(warehouses).getByRole('option')).toHaveTextContent('North Shed2 doors · 1 archived')
  expect(doors).toHaveTextContent('Doors1')
  expect(within(doors).getByRole('option')).toHaveTextContent('North DoorIn North Shed')
  expect(
    screen.getByText(
      'Enter opens the highlighted result. Archived results appear when Archived is on.',
    ),
  ).toBeInTheDocument()
})

test('searches only the selected statuses', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses('/warehouses?status=available')

  await user.type(await screen.findByRole('combobox', { name: 'Search warehouses' }), 'door')

  const results = await screen.findByRole('listbox', { name: 'Search results' })

  expect(
    within(results)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['North DoorIn North Shed'])
})

test('opens a door result on its warehouse with the door highlighted', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses('/warehouses?status=available')

  await user.type(await screen.findByRole('combobox', { name: 'Search warehouses' }), 'north door')
  await user.click(await screen.findByRole('option', { name: /^North Door/ }))

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      warehouseId: NORTH_SHED.id,
      doorId: NORTH_DOOR?.id,
      doorStatus: 'available',
      search: 'north door',
    }),
  )
  expect(await screen.findByRole('complementary', { name: NORTH_SHED.name })).toBeInTheDocument()
})

test('opens the highlighted warehouse with Enter', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses('/warehouses?status=available')

  const input = await screen.findByRole('combobox', { name: 'Search warehouses' })
  await user.type(input, 'shed')
  await screen.findByRole('listbox', { name: 'Search results' })
  await user.keyboard('{ArrowDown}')
  await user.keyboard('{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ warehouseId: NORTH_SHED.id }),
  )
})
