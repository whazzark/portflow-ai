import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCK_OBSERVER, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const NORTH_DOCK = DOCKS[1]
const RETIRED_DOCK = DOCKS[2]

async function openDock(user: ReturnType<typeof userEvent.setup>, name: string, status: string) {
  await user.click(await screen.findByRole('button', { name: `View dock ${name} (${status})` }))
  await screen.findByRole('heading', { name })
}

test('offers archiving on an available dock to an administrator', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, NORTH_DOCK.name, 'Available')

  expect(screen.getByRole('button', { name: 'Archive dock' })).toBeInTheDocument()
})

test('does not offer archiving to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, NORTH_DOCK.name, 'Available')

  expect(screen.queryByRole('button', { name: 'Archive dock' })).not.toBeInTheDocument()
})

test('does not offer archiving an already archived dock', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, RETIRED_DOCK.name, 'Archived')

  expect(screen.queryByRole('button', { name: 'Archive dock' })).not.toBeInTheDocument()
})

test('archives a dock with a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const archived = {
    ...NORTH_DOCK,
    status: 'ARCHIVED' as const,
    archivedAt: '2026-08-24T00:00:00.000Z',
    archiveComment: 'Quay closed for resurfacing',
  }
  let currentDocks = DOCKS

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}/archive`, async ({ request }) => {
      capturedBody = await request.json()
      currentDocks = currentDocks.map((dock) => (dock.id === NORTH_DOCK.id ? archived : dock))
      return HttpResponse.json({ data: archived })
    }),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
  )

  renderCheckpoints()
  await openDock(user, NORTH_DOCK.name, 'Available')

  await user.click(screen.getByRole('button', { name: 'Archive dock' }))
  await screen.findByRole('heading', { name: 'Archive dock?' })
  await user.type(screen.getByRole('textbox', { name: /comment/i }), 'Quay closed for resurfacing')
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Dock archived')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Quay closed for resurfacing' })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive dock' })).not.toBeInTheDocument(),
  )
})

test('archives a dock without a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const archived = { ...NORTH_DOCK, status: 'ARCHIVED' as const }

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}/archive`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ data: archived })
    }),
  )

  renderCheckpoints()
  await openDock(user, NORTH_DOCK.name, 'Available')

  await user.click(screen.getByRole('button', { name: 'Archive dock' }))
  await screen.findByRole('heading', { name: 'Archive dock?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Dock archived')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: null })
})
