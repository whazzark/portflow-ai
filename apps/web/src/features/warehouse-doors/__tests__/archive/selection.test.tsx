import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  API_BASE_URL,
  BULK_WAREHOUSES,
  doorLifecycle,
  WAREHOUSE_ADMIN,
  WAREHOUSE_OBSERVER,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  mockWarehouses,
  renderWarehouses,
} from '@/features/warehouses/__tests__/support/test-helpers'
import { server } from '@/test/msw/server'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('@/features/warehouses/__tests__/support/mock-warehouse-map'),
)

const AVAILABLE = WAREHOUSES[0]
const ARCHIVED_WAREHOUSE = WAREHOUSES[1]
const DOOR = (AVAILABLE.doors ?? [])[0]
const ARCHIVED_DOOR_ROW = (AVAILABLE.doors ?? [])[1]

const path = (search = '') => `/warehouses?status=all&warehouseId=${AVAILABLE.id}${search}`

/** Two available doors in one warehouse, which `WAREHOUSES[0]` cannot give: archiving its only
 * available door empties the list, and a selection that outlives the row it was built on is only
 * observable while some other row keeps the selection row on screen. */
const TWO_DOOR_WAREHOUSE = BULK_WAREHOUSES[1]
const FIRST_DOOR = (TWO_DOOR_WAREHOUSE.doors ?? [])[0]
const SECOND_DOOR = (TWO_DOOR_WAREHOUSE.doors ?? [])[1]
const TWO_DOOR_COLLECTION = [TWO_DOOR_WAREHOUSE, ARCHIVED_WAREHOUSE]
const ARCHIVED_AT = '2026-08-27T14:03:07.000Z'
const AFTER_ROW_ARCHIVAL = [
  {
    ...TWO_DOOR_WAREHOUSE,
    doors: (TWO_DOOR_WAREHOUSE.doors ?? []).map((door) =>
      door.id === FIRST_DOOR.id
        ? { ...door, status: 'ARCHIVED' as const, ...doorLifecycle({ archivedAt: ARCHIVED_AT }) }
        : door,
    ),
  },
  ARCHIVED_WAREHOUSE,
]
const twoDoorPath = `/warehouses?status=all&warehouseId=${TWO_DOOR_WAREHOUSE.id}`

/** Flips the collection once the row archival lands, so the panel refetches the list the
 * administrator would really see next. */
function mockRowArchival() {
  let archived = false

  mockWarehouses(WAREHOUSE_ADMIN, TWO_DOOR_COLLECTION)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
      HttpResponse.json({ data: archived ? AFTER_ROW_ARCHIVAL : TWO_DOOR_COLLECTION }),
    ),
    http.post(`${API_BASE_URL}/api/v1/warehouse-doors/${FIRST_DOOR.id}/archive`, () => {
      archived = true

      return HttpResponse.json({
        data: {
          id: FIRST_DOOR.id,
          warehouseId: TWO_DOOR_WAREHOUSE.id,
          name: FIRST_DOOR.name,
          status: 'ARCHIVED',
          latitude: FIRST_DOOR.latitude,
          longitude: FIRST_DOOR.longitude,
          archivedAt: ARCHIVED_AT,
          archivedByUserId: '018f7f21-5d0e-7a55-9d0e-2c9a3f5b1a44',
          archiveComment: null,
          archivedWithWarehouse: false,
          createdAt: '2026-08-20T09:12:44.000Z',
          updatedAt: ARCHIVED_AT,
        },
      })
    }),
  )
}

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

test('offers a checkbox on every available door row as soon as the warehouse opens', async () => {
  renderWarehouses(path())

  // No mode to enter: opening an available warehouse is the whole gesture.
  expect(
    await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select all available doors' })).toBeInTheDocument()
})

test('offers no checkbox to a non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER)
  renderWarehouses(path())

  expect(await screen.findByText(DOOR.name)).toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).not.toBeInTheDocument()
})

test('offers no checkbox on an archived warehouse, whose doors are all archived already', async () => {
  renderWarehouses(`/warehouses?status=all&warehouseId=${ARCHIVED_WAREHOUSE.id}`)

  await screen.findByRole('heading', { name: 'Doors' })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('offers no checkbox for an archived door', async () => {
  renderWarehouses(path())

  await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` })
  expect(
    screen.queryByRole('checkbox', { name: `Select door ${ARCHIVED_DOOR_ROW.name}` }),
  ).not.toBeInTheDocument()
})

test('checks a door from the list and mirrors it on the map, and back', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))

  const marker = await screen.findByRole('button', { name: `Deselect door ${DOOR.name}` })
  expect(marker).toHaveAttribute('aria-pressed', 'true')

  await user.click(marker)

  expect(
    await screen.findByRole('button', { name: `Select door ${DOOR.name}` }),
  ).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).not.toBeChecked()
})

test('a marker click checks the door and highlights it in the same gesture', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(path())

  await user.click(await screen.findByRole('button', { name: `Select door ${DOOR.name}` }))

  // Checked…
  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).toBeChecked()
  // …and highlighted, which is what tells the administrator which door they just checked.
  await waitFor(() => expect(router.state.location.search.doorId).toBe(DOOR.id))
})

test('selects every listed available door at once', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: 'Select all available doors' }))

  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('empties the selection when the archived door view is opened', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  expect(await screen.findByRole('button', { name: 'Archive selected' })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Archived/ }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})

test('does not resurrect the selection when the Available view is reopened', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(screen.getByRole('tab', { name: /Archived/ }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Available/ }))

  expect(
    await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).not.toBeChecked()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('withdraws the selection while a door creation session owns the panel', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(screen.getByRole('button', { name: 'Create door' }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})

test('leaves the other warehouses selectable while no door is checked', async () => {
  const user = userEvent.setup()
  const { router } = renderWarehouses(path())

  // Checking doors is offered on every open available warehouse, so it must cost nothing until a
  // door is actually checked: switching warehouse is the ordinary gesture, not an escape from a
  // mode.
  const other = await screen.findByRole('button', {
    name: `View warehouse ${ARCHIVED_WAREHOUSE.name} (Archived)`,
  })
  expect(other).toBeEnabled()

  await user.click(other)

  await waitFor(() => expect(router.state.location.search.warehouseId).toBe(ARCHIVED_WAREHOUSE.id))
})

test('stops a polygon click moving the warehouse under a selection in progress', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))

  expect(
    screen.getByRole('button', { name: `View warehouse ${ARCHIVED_WAREHOUSE.name} (Archived)` }),
  ).toBeDisabled()
})

test('counts the selection and clears it in one gesture', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  expect(await screen.findByText('1 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.getByRole('checkbox', { name: `Select door ${DOOR.name}` })).not.toBeChecked()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
})

test('drops a door archived from its own row menu out of the selection', async () => {
  mockRowArchival()
  const user = userEvent.setup()
  renderWarehouses(twoDoorPath)

  await user.click(await screen.findByRole('checkbox', { name: `Select door ${FIRST_DOOR.name}` }))
  await user.click(screen.getByRole('checkbox', { name: `Select door ${SECOND_DOOR.name}` }))
  expect(await screen.findByText('2 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: `Actions for ${FIRST_DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  // The archived door leaves the Available list and leaves the selection with it, so what
  // `Archive selected` would submit is only what the administrator can still see.
  expect(await screen.findByText('1 selected')).toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: `Select door ${FIRST_DOOR.name}` }),
  ).not.toBeInTheDocument()
})

test('does not bring the selection back when a door creation is cancelled', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(screen.getByRole('button', { name: 'Create door' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))

  expect(
    await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).not.toBeChecked()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('does not bring the selection back when the same warehouse is reopened', async () => {
  const user = userEvent.setup()
  renderWarehouses(path())
  await user.click(await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }))
  await screen.findByRole('button', { name: 'Archive selected' })

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Doors' })).not.toBeInTheDocument(),
  )
  await user.click(
    screen.getByRole('button', { name: `View warehouse ${AVAILABLE.name} (Available)` }),
  )

  expect(
    await screen.findByRole('checkbox', { name: `Select door ${DOOR.name}` }),
  ).not.toBeChecked()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
