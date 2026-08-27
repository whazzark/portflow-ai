import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  API_BASE_URL,
  ARCHIVED_DOOR,
  WAREHOUSE_ADMIN,
  WAREHOUSES,
  WAREHOUSES_WITH_ARCHIVED_DOOR,
} from '@/features/warehouses/__tests__/support/fixtures'
import {
  archiveWarehouseDoorAlreadyArchivedHandler,
  archiveWarehouseDoorInUseHandler,
  archiveWarehouseDoorRecoveringHandler,
} from '@/features/warehouses/__tests__/support/handlers'
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
const DOOR = (AVAILABLE.doors ?? [])[0]

beforeEach(() => {
  mockWarehouses(WAREHOUSE_ADMIN)
})

async function openArchiveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))

  return screen.findByRole('alertdialog')
}

async function submit(user: ReturnType<typeof userEvent.setup>, comment?: string) {
  const dialog = await openArchiveDialog(user)
  if (comment) {
    await user.type(within(dialog).getByRole('textbox'), comment)
  }
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  return dialog
}

test('names the door and the reason when the door is in use', async () => {
  server.use(archiveWarehouseDoorInUseHandler(DOOR.id))
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await submit(user)

  expect(await screen.findByText(`Unable to archive door “${DOOR.name}”`)).toBeInTheDocument()
  expect(await screen.findByText(/used by a planned or active discharge/)).toBeInTheDocument()
})

test('reports an already archived door distinctly from an in-use one', async () => {
  server.use(archiveWarehouseDoorAlreadyArchivedHandler(DOOR.id))
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await submit(user)

  expect(await screen.findByText(/already archived/)).toBeInTheDocument()
  expect(screen.queryByText(/planned or active discharge/)).not.toBeInTheDocument()
})

test('keeps the dialog open with the typed comment after a refusal', async () => {
  server.use(archiveWarehouseDoorInUseHandler(DOOR.id))
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  const dialog = await submit(user, 'Walled up')

  await screen.findByText(/used by a planned or active discharge/)
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox')).toHaveValue('Walled up')
})

test('refreshes the collection after a refusal, so a stale view catches up', async () => {
  // Another administrator archived the door in the meantime: the attempt is refused, and the
  // refresh the refusal triggers is what replaces this administrator's stale view.
  let refusedOnce = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
      HttpResponse.json({ data: refusedOnce ? WAREHOUSES_WITH_ARCHIVED_DOOR : WAREHOUSES }),
    ),
    http.post(`${API_BASE_URL}/api/v1/warehouse-doors/${DOOR.id}/archive`, () => {
      refusedOnce = true
      return HttpResponse.json(
        {
          error: {
            code: 'E_WAREHOUSE_DOOR_ALREADY_ARCHIVED',
            message: 'Warehouse door is already archived',
          },
        },
        { status: 409 },
      )
    }),
  )
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  await submit(user)
  await screen.findByText(/already archived/)

  // The row loses its menu because the refreshed collection no longer holds it as available.
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: `Actions for ${DOOR.name}` }),
    ).not.toBeInTheDocument(),
  )
})

test('reports a transient failure as retryable and archives exactly once on retry', async () => {
  let archived = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
      HttpResponse.json({ data: archived ? WAREHOUSES_WITH_ARCHIVED_DOOR : WAREHOUSES }),
    ),
    archiveWarehouseDoorRecoveringHandler(ARCHIVED_DOOR),
  )
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  const dialog = await submit(user, 'Walled up')
  expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument()

  // Retried from the still-open dialog, with the comment the administrator already typed.
  expect(within(dialog).getByRole('textbox')).toHaveValue('Walled up')
  archived = true
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Door “${DOOR.name}” archived`)).toBeInTheDocument()
})
