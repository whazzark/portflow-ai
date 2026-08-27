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

/**
 * The collection the panel reads, keyed on whether the archival has happened rather than on how
 * many times it was fetched: the query refetches on its own, so a fixed sequence would flip the
 * door to archived before the administrator ever opened the menu.
 */
function mockArchival() {
  const captured: { body?: unknown; calls: number } = { calls: 0 }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
      HttpResponse.json({
        data: captured.calls > 0 ? WAREHOUSES_WITH_ARCHIVED_DOOR : WAREHOUSES,
      }),
    ),
    http.post(`${API_BASE_URL}/api/v1/warehouse-doors/${DOOR.id}/archive`, async ({ request }) => {
      captured.body = await request.json()
      captured.calls += 1
      return HttpResponse.json({ data: ARCHIVED_DOOR })
    }),
  )

  return captured
}

async function openArchiveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))

  return screen.findByRole('alertdialog')
}

test('archives the door with an optional comment', async () => {
  const captured = mockArchival()
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  const dialog = await openArchiveDialog(user)
  const comment = within(dialog).getByRole('textbox')
  expect(comment).toHaveAttribute('maxLength', '1000')
  await user.type(comment, 'Walled up during the 2026 works')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Door “${DOOR.name}” archived`)).toBeInTheDocument()
  expect(captured.body).toMatchObject({ comment: 'Walled up during the 2026 works' })
})

test('sends no comment when the field is left empty', async () => {
  const captured = mockArchival()
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Door “${DOOR.name}” archived`)).toBeInTheDocument()
  expect(captured.body).toMatchObject({ comment: null })
})

test('leaves the door untouched when the confirmation is abandoned', async () => {
  const captured = mockArchival()
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(captured.calls).toBe(0)
  expect(
    await screen.findByRole('button', { name: `Actions for ${DOOR.name}` }),
  ).toBeInTheDocument()
})

test('shows the archived door under the Archived view, retired on its own', async () => {
  mockArchival()
  const user = userEvent.setup()
  renderWarehouses(`/warehouses?status=all&warehouseId=${AVAILABLE.id}`)

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))
  await screen.findByText(`Door “${DOOR.name}” archived`)

  await user.click(await screen.findByRole('tab', { name: /Archived/ }))

  const archivedList = await screen.findByRole('list', { name: 'Archived warehouse doors' })
  const row = within(archivedList).getByText(DOOR.name).closest('li')
  // Scoped to the door's own row: the warehouse already holds another door retired on its own, and
  // the provenance line is what tells the two archivals apart from a cascaded one.
  expect(row).not.toBeNull()
  expect(within(row as HTMLElement).getByText(/Archived on its own/)).toBeInTheDocument()
  expect(
    within(row as HTMLElement).getByText(/Walled up during the 2026 works/),
  ).toBeInTheDocument()
})
