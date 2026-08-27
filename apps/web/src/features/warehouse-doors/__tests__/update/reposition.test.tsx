import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  BULK_WAREHOUSES,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const AVAILABLE = WAREHOUSES[0]
const DOOR = (AVAILABLE.doors ?? [])[0]
const EDIT_PATH = `/warehouses?status=all&warehouseId=${AVAILABLE.id}&doorId=${DOOR.id}&edit=door`

/** `WAREHOUSES[0]` holds exactly one available door — the one under edit — so a *sibling* marker
 * needs the wider fixture set, whose East Shed has two. */
const SIBLING_WAREHOUSE = BULK_WAREHOUSES[1]
const SIBLING_EDITED = (SIBLING_WAREHOUSE.doors ?? [])[0]
const SIBLING_OTHER = (SIBLING_WAREHOUSE.doors ?? [])[1]
const SIBLING_EDIT_PATH = `/warehouses?status=all&warehouseId=${SIBLING_WAREHOUSE.id}&doorId=${SIBLING_EDITED.id}&edit=door`

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

test('replaces the door’s own marker with a labelled draft, keeping the others', async () => {
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  // Its ordinary marker is withheld, so a stale stored position and the live draft never both
  // claim the same door.
  expect(screen.queryByRole('button', { name: `${DOOR.name} door marker` })).not.toBeInTheDocument()
  expect(screen.getByTestId('draft-door')).toHaveTextContent(`${DOOR.latitude}, ${DOOR.longitude}`)
  // The label names the door being moved rather than reading "New door".
  expect(screen.getAllByText(DOOR.name).length).toBeGreaterThan(0)
})

test('keeps the warehouse’s other doors on the map while one is corrected', async () => {
  mockWarehouses(WAREHOUSE_ADMIN, BULK_WAREHOUSES)
  renderWarehouses(SIBLING_EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  // The sibling stays rendered: it is what the administrator is repositioning between.
  expect(
    screen.getByRole('button', { name: `${SIBLING_OTHER.name} door marker` }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `${SIBLING_EDITED.name} door marker` }),
  ).not.toBeInTheDocument()
})

test('dragging the draft moves it and updates the coordinate fields', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.click(screen.getByRole('button', { name: 'Simulate dragging the door being edited' }))

  await waitFor(() =>
    expect(screen.getByLabelText('Latitude')).toHaveValue(String(DOOR.latitude + 0.0005)),
  )
  expect(screen.getByTestId('draft-door')).toHaveTextContent(String(DOOR.latitude + 0.0005))
})

test('typing coordinates moves the draft, with no map interaction at all', async () => {
  const user = userEvent.setup()
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  await user.clear(screen.getByLabelText('Latitude'))
  await user.type(screen.getByLabelText('Latitude'), '48.854')
  await user.clear(screen.getByLabelText('Longitude'))
  await user.type(screen.getByLabelText('Longitude'), '2.351')

  await waitFor(() => expect(screen.getByTestId('draft-door')).toHaveTextContent('48.854, 2.351'))
})

test('a map click away from the draft selects nothing and moves nothing', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  const before = screen.getByTestId('draft-door').textContent

  await user.click(
    screen.getByRole('button', { name: 'Simulate map click away from the door being edited' }),
  )

  expect(screen.getByTestId('draft-door')).toHaveTextContent(before ?? '')
  expect(router.state.location.search).toMatchObject({ doorId: DOOR.id, edit: 'door' })
  expect(await screen.findByRole('heading', { name: 'Edit door' })).toBeInTheDocument()
})

test('clicking another door’s marker neither selects it nor moves the draft', async () => {
  const user = userEvent.setup()
  mockWarehouses(WAREHOUSE_ADMIN, BULK_WAREHOUSES)
  const { router } = renderWarehouses(SIBLING_EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  const before = screen.getByTestId('draft-door').textContent

  await user.click(screen.getByRole('button', { name: `${SIBLING_OTHER.name} door marker` }))

  expect(screen.getByTestId('draft-door')).toHaveTextContent(before ?? '')
  expect(router.state.location.search).toMatchObject({
    doorId: SIBLING_EDITED.id,
    edit: 'door',
  })
})

test('a warehouse polygon cannot be selected while a door is corrected', async () => {
  renderWarehouses(EDIT_PATH)

  await screen.findByRole('heading', { name: 'Edit door' })
  expect(
    screen.getByRole('button', { name: 'View warehouse North Shed (Available)' }),
  ).toBeDisabled()
})
