import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, MIXED_ARCHIVED_WAREHOUSE, WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const MIXED = MIXED_ARCHIVED_WAREHOUSE
const AVAILABLE = WAREHOUSES[0]
const CATALOGUE = [AVAILABLE, MIXED]

const reactivateUrl = (id: string) => `${API_BASE_URL}/api/v1/warehouses/${id}/reactivate`

async function openReactivateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${MIXED.name} (Archived)` }),
  )
  await user.click(await screen.findByRole('button', { name: 'Reactivate warehouse' }))

  return screen.findByRole('alertdialog')
}

/** The API answers `{ data: { warehouse, reactivatedDoorCount } }`; the client reads the envelope,
 * so the mock reproduces it rather than a flattened shape. */
function reactivatedResponse(reactivatedDoorCount: number) {
  return {
    data: {
      warehouse: {
        ...MIXED,
        status: 'AVAILABLE',
        reactivatedAt: '2026-08-25T10:00:00.000Z',
        doors: MIXED.doors?.map((door) =>
          door.archivedWithWarehouse
            ? { ...door, status: 'AVAILABLE', archivedWithWarehouse: false }
            : door,
        ),
      },
      reactivatedDoorCount,
    },
  }
}

test('offers reactivation for an archived warehouse and archival for an available one', async () => {
  mockWarehouses(undefined, CATALOGUE)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${AVAILABLE.name} (Available)` }),
  )
  expect(await screen.findByRole('button', { name: 'Archive warehouse' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate warehouse' })).not.toBeInTheDocument()

  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${MIXED.name} (Archived)` }),
  )
  expect(await screen.findByRole('button', { name: 'Reactivate warehouse' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive warehouse' })).not.toBeInTheDocument()
})

test('states how many doors return to service with the warehouse', async () => {
  mockWarehouses(undefined, CATALOGUE)
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openReactivateDialog(user)

  expect(within(dialog).getByRole('heading', { name: 'Reactivate warehouse?' })).toBeInTheDocument()
  // Mixed Shed holds one door archived with it and one archived on its own.
  expect(dialog).toHaveTextContent('Its 1 door archived with it returns to service')
  expect(dialog).toHaveTextContent('selectable again for new operational work')
})

test('reactivates the warehouse and reports the restored doors', async () => {
  let capturedBody: unknown
  mockWarehouses(undefined, CATALOGUE)
  server.use(
    http.post(reactivateUrl(MIXED.id), async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json(reactivatedResponse(1))
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openReactivateDialog(user)
  await user.type(within(dialog).getByRole('textbox'), 'Zone reopened')
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Warehouse reactivated with 1 door')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Zone reopened' })
})

// The count comes from the response, not from the advisory number the dialog showed, so a restore
// that turned out to touch nothing must not claim a door came back.
test('reports a reactivation that restored no door without naming a count', async () => {
  mockWarehouses(undefined, CATALOGUE)
  server.use(http.post(reactivateUrl(MIXED.id), () => HttpResponse.json(reactivatedResponse(0))))
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openReactivateDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Warehouse reactivated')).toBeInTheDocument()
})

test('sends no comment when the field is left empty', async () => {
  let capturedBody: unknown
  mockWarehouses(undefined, CATALOGUE)
  server.use(
    http.post(reactivateUrl(MIXED.id), async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json(reactivatedResponse(1))
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openReactivateDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  await screen.findByText(/Warehouse reactivated/)
  expect(capturedBody).toMatchObject({ comment: null })
})

test('leaves the warehouse untouched when the confirmation is abandoned', async () => {
  let requested = false
  mockWarehouses(undefined, CATALOGUE)
  server.use(
    http.post(reactivateUrl(MIXED.id), () => {
      requested = true
      return HttpResponse.json(reactivatedResponse(1))
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openReactivateDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(requested).toBe(false)
  expect(
    await screen.findByRole('button', { name: `View warehouse ${MIXED.name} (Archived)` }),
  ).toBeInTheDocument()
})

test('shows the archive context beside the reactivation context', async () => {
  mockWarehouses(undefined, CATALOGUE)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${MIXED.name} (Archived)` }),
  )

  expect(await screen.findByText('Zone closed for works')).toBeInTheDocument()
})
