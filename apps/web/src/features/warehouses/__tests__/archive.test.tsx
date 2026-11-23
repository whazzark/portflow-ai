import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, WAREHOUSES } from './support/fixtures'
import { warehousesHandler } from './support/handlers'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]

async function openArchiveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${NORTH_SHED.name} (Available)` }),
  )
  await user.click(await screen.findByRole('button', { name: 'Archive' }))

  return screen.findByRole('alertdialog')
}

test('names the warehouse and what stops being selectable', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)

  expect(
    within(dialog).getByRole('heading', { name: `Archive ${NORTH_SHED.name}?` }),
  ).toBeInTheDocument()
  // North Shed holds one available door and one already archived door: only the available one
  // stops being selectable for new discharges.
  expect(dialog).toHaveTextContent(
    'The warehouse and its available door can no longer be selected for new discharges. Past discharges keep them. You can reactivate it later from Archived.',
  )
  // The optional comment stays: the domain records it.
  expect(within(dialog).getByRole('textbox')).toBeInTheDocument()
})

test('archives the warehouse and reports the cascade', async () => {
  let capturedBody: unknown
  mockWarehouses()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/warehouses/${NORTH_SHED.id}/archive`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: {
          warehouse: {
            ...NORTH_SHED,
            status: 'ARCHIVED',
            // The cascade takes every door, whatever its own status was.
            doors: NORTH_SHED.doors?.map((door) => ({ ...door, status: 'ARCHIVED' })),
          },
          archivedDoorCount: 2,
        },
      })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)
  await user.type(within(dialog).getByRole('textbox'), 'Building repurposed')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Warehouse “${NORTH_SHED.name}” archived`)).toBeInTheDocument()
  expect(
    screen.getByText('Its 2 doors are archived with it. Find it under Archived to reactivate it.'),
  ).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Building repurposed' })
})

test('View on the archival toast opens the archived warehouse', async () => {
  const archived = {
    ...NORTH_SHED,
    status: 'ARCHIVED' as const,
    archivedAt: '2026-09-16T13:44:00.000Z',
    doors: NORTH_SHED.doors?.map((door) => ({ ...door, status: 'ARCHIVED' as const })),
  }
  mockWarehouses()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/warehouses/${NORTH_SHED.id}/archive`, () => {
      server.use(warehousesHandler([archived, WAREHOUSES[1]]))
      return HttpResponse.json({ data: { warehouse: archived, archivedDoorCount: 2 } })
    }),
  )
  const user = userEvent.setup()
  const { router } = renderWarehouses('/warehouses?status=available')

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))
  // From the keyboard: sonner captures the pointer on a toast press, which jsdom does not implement.
  ;(await screen.findByRole('button', { name: 'View' })).focus()
  await user.keyboard('{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      status: 'all',
      warehouseId: NORTH_SHED.id,
    }),
  )
  const card = await screen.findByRole('complementary', { name: NORTH_SHED.name })
  expect(within(card).getByText('Warehouse · Archived')).toBeInTheDocument()
  expect(card).toHaveTextContent(
    'It and its doors can’t be selected for new discharges; past discharges keep them.',
  )
  expect(within(card).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  for (const name of ['Edit', 'Archive', 'Create door']) {
    expect(within(card).queryByRole('button', { name })).not.toBeInTheDocument()
  }
})

test('leaves the warehouse untouched when the confirmation is abandoned', async () => {
  let requested = false
  mockWarehouses()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/warehouses/${NORTH_SHED.id}/archive`, () => {
      requested = true
      return HttpResponse.json({ data: NORTH_SHED, archivedDoorCount: 0 })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(requested).toBe(false)
})
