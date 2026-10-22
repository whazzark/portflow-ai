import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN, WAREHOUSES } from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const NORTH_DOOR = NORTH_SHED.doors?.[0]

async function openDoorMenu(user: ReturnType<typeof userEvent.setup>, path?: string) {
  const rendered = renderWarehouses(path ?? `/warehouses?warehouseId=${NORTH_SHED.id}`)
  const card = await screen.findByRole('complementary', { name: NORTH_SHED.name })
  await user.click(within(card).getByRole('button', { name: `Actions for ${NORTH_DOOR?.name}` }))

  return rendered
}

test('offers Edit, Show on map, Copy coordinates and Archive on an available door', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const user = userEvent.setup()
  await openDoorMenu(user)

  expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
    'Edit',
    'Show on map',
    'Copy coordinates',
    'Archive',
  ])
})

test('Show on map highlights the door', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const user = userEvent.setup()
  const { router } = await openDoorMenu(user)

  await user.click(await screen.findByRole('menuitem', { name: 'Show on map' }))

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ doorId: NORTH_DOOR?.id }),
  )
})

test('Copy coordinates copies the unloading point', async () => {
  mockWarehouses(WAREHOUSE_ADMIN)
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await openDoorMenu(user)

  await user.click(await screen.findByRole('menuitem', { name: 'Copy coordinates' }))

  expect(writeText).toHaveBeenCalledWith('48.8550, 2.3450')
  expect(await screen.findByText('Coordinates copied')).toBeInTheDocument()
})
