import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { WAREHOUSE_ADMIN, WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const NORTH_DOOR = NORTH_SHED.doors?.[0]

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

// biome-ignore lint/security/noSecrets: an attribute selector, not a secret
const STATUS_SELECTOR = '[role="status"]'
const banner = (text: string) => screen.findByText(text, { selector: STATUS_SELECTOR })

async function openNorthShed(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${NORTH_SHED.name} (Available)` }),
  )
  return screen.findByRole('complementary', { name: NORTH_SHED.name })
}

test('drawing replaces the toolbar with its banner and a New warehouse card', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Create warehouse' }))

  expect(
    await banner('Drawing a new warehouse · click the first point to close the outline'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Search warehouses' })).not.toBeInTheDocument()
  const card = screen.getByRole('complementary', { name: 'New warehouse' })
  expect(card).toHaveTextContent('Click the map to add corners.')

  for (let point = 0; point < 3; point += 1) {
    await user.click(
      screen.getByRole('button', { name: 'Simulate map click to add footprint point' }),
    )
  }
  expect(card).toHaveTextContent('3 points placed')
  expect(card).toHaveTextContent('Close the outline to create the warehouse.')

  await user.keyboard('{Escape}')

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(await screen.findByRole('combobox', { name: 'Search warehouses' })).toBeInTheDocument()
})

test('the banner’s Cancel leaves drawing without creating anything', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses()

  await user.click(await screen.findByRole('button', { name: 'Create warehouse' }))
  await banner('Drawing a new warehouse · click the first point to close the outline')
  await user.click(screen.getByRole('button', { name: 'Cancel drawing' }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
})

test('outline editing counts moved points and undoes one change at a time', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  const card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: 'Edit' }))

  expect(
    await banner(`Drag a point to reshape ${NORTH_SHED.name} · click a midpoint to add one`),
  ).toBeInTheDocument()
  const editCard = screen.getByRole('complementary', { name: 'Edit warehouse' })
  expect(editCard).toHaveTextContent('Previous outline shown dashed.')
  expect(within(editCard).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Simulate dragging boundary point 2' }))
  expect(editCard).toHaveTextContent('3 boundary points · 1 moved')
  await user.click(screen.getByRole('button', { name: 'Simulate inserting on edge 1' }))
  expect(editCard).toHaveTextContent('4 boundary points · 2 moved')

  await user.click(within(editCard).getByRole('button', { name: 'Undo' }))
  expect(editCard).toHaveTextContent('3 boundary points · 1 moved')
  await user.click(within(editCard).getByRole('button', { name: 'Undo' }))
  expect(editCard).toHaveTextContent('3 boundary points')
  expect(editCard).not.toHaveTextContent('moved')
  expect(within(editCard).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
})

test('door placement announces its warehouse in the banner and the New door card', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  const card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: 'Create door' }))

  expect(await banner(`Placing a new door · click inside ${NORTH_SHED.name}`)).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: 'New door' })).toHaveTextContent(
    `In ${NORTH_SHED.name} · drag the pin to adjust.`,
  )
})

test('moving a door shows its previous position', async () => {
  const user = userEvent.setup()
  renderWarehouses()

  const card = await openNorthShed(user)
  await user.click(within(card).getByRole('button', { name: `Actions for ${NORTH_DOOR?.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

  expect(
    await banner(
      `Drag the pin to move ${NORTH_DOOR?.name} · it must stay inside ${NORTH_SHED.name}`,
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: 'Edit door' })).toHaveTextContent(
    'Previous position 48.8550, 2.3450',
  )
})
