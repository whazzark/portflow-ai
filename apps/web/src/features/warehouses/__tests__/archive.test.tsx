import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, WAREHOUSES } from './support/fixtures'
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

test('states how many doors are archived with the warehouse', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)

  expect(within(dialog).getByRole('heading', { name: 'Archive warehouse?' })).toBeInTheDocument()
  // North Shed holds one available door and one already archived door: the archival takes both,
  // the second for a second time.
  expect(dialog).toHaveTextContent('Its 2 doors are archived with it')
  expect(dialog).toHaveTextContent('no longer available for new operations')
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

  expect(
    await screen.findByText(`Warehouse “${NORTH_SHED.name}” archived with 2 doors`),
  ).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Building repurposed' })
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
