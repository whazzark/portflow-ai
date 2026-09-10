import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BULK_WAREHOUSES, WAREHOUSE_OBSERVER } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH = BULK_WAREHOUSES[0]
/** Two available doors, so an open panel of this one does offer a door selection. */
const EAST = BULK_WAREHOUSES[1]
const WEST = BULK_WAREHOUSES[2]
const ARCHIVED = BULK_WAREHOUSES[3]

const marker = (warehouse: (typeof BULK_WAREHOUSES)[number]) =>
  screen.getByRole('button', {
    name: `View warehouse ${warehouse.name} (${warehouse.status === 'ARCHIVED' ? 'Archived' : 'Available'})`,
  })

test('Ctrl+A checks every visible available warehouse and enters select mode', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')

  // Three of the four fixtures are available; the archived one is never checkable.
  expect(await screen.findByText('3 selected')).toBeInTheDocument()
})

test('Escape clears the selection without leaving select mode', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')
  expect(await screen.findByText('3 selected')).toBeInTheDocument()

  await user.keyboard('{Escape}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: 'Stop selecting warehouses' }),
  ).toBeInTheDocument()
})

test('ignores Ctrl+A while a text field has focus', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(await screen.findByRole('textbox', { name: 'Search warehouses' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('offers no shortcut to an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

/**
 * The panel this page opens is deliberately unmodal — `modal={false}`, no overlay, no dismissal on
 * an outside click — so an open warehouse never puts the map out of reach. Which of the two
 * collections Ctrl/Cmd+A means is therefore settled by where focus is, and not by whether the open
 * warehouse happens to offer a door selection.
 */

test('keeps Ctrl+A on the map when focus went back to it behind an open panel', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${EAST.id}`)

  // East Shed's own Available doors are selectable, which used to disable the map's shortcut
  // outright — while the map behind stayed pannable, filterable and clickable.
  await screen.findByRole('heading', { name: 'Doors' })
  await user.click(marker(WEST))

  await user.keyboard('{Control>}a{/Control}')

  // Three of the four fixtures are available; the archived one is never checkable.
  expect(await screen.findByText('3 selected')).toBeInTheDocument()
})

test('leaves an open panel alone when Ctrl+A is pressed inside one with no doors to select', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  const { router } = renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED.id}`)

  // An archived warehouse is read-only, so its doors offer no selection. The keystroke has nothing
  // to act on — and must not fall through to the map, whose select-all clears `warehouseId` and
  // would close the very panel being read.
  await screen.findByRole('heading', { name: 'Doors' })
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('toolbar', { name: 'Bulk warehouse actions' })).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ warehouseId: ARCHIVED.id })
  expect(screen.getByRole('heading', { name: 'Doors' })).toBeInTheDocument()
})

test('keeps an in-progress footprint edit when Ctrl+A is pressed inside its panel', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${NORTH.id}&edit=warehouse`)

  // An update session replaces the doors list with a form and arms the map, so it too offers no
  // door selection — and the map's select-all would drop the session and its draft points.
  await screen.findByRole('heading', { name: 'Edit warehouse' })
  await user.keyboard('{Control>}a{/Control}')

  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Edit warehouse' })).toBeInTheDocument(),
  )
  expect(screen.queryByText('3 selected')).not.toBeInTheDocument()
})
