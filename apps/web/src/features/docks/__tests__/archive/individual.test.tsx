import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

  expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('does not offer archiving to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, NORTH_DOCK.name, 'Available')

  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('does not offer archiving an already archived dock', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, RETIRED_DOCK.name, 'Archived')

  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
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

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await screen.findByRole('heading', { name: `Archive ${NORTH_DOCK.name}?` })
  await user.type(screen.getByRole('textbox', { name: /comment/i }), 'Quay closed for resurfacing')
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`${NORTH_DOCK.name} archived`)).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Quay closed for resurfacing' })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument(),
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

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await screen.findByRole('heading', { name: `Archive ${NORTH_DOCK.name}?` })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`${NORTH_DOCK.name} archived`)).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: null })
})

test('explains archiving in discharge terms and offers to view the archived dock', async () => {
  const user = userEvent.setup()
  const archived = {
    ...NORTH_DOCK,
    status: 'ARCHIVED' as const,
    archivedAt: '2026-08-24T00:00:00.000Z',
  }
  let currentDocks = DOCKS

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}/archive`, () => {
      currentDocks = currentDocks.map((dock) => (dock.id === NORTH_DOCK.id ? archived : dock))
      return HttpResponse.json({ data: archived })
    }),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  const { router } = renderCheckpoints('/checkpoints?status=available')
  await openDock(user, NORTH_DOCK.name, 'Available')

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog', { name: `Archive ${NORTH_DOCK.name}?` })
  expect(dialog).toHaveTextContent(
    'The dock can no longer be selected for new discharges. Past discharges keep it. You can reactivate it later from Archived.',
  )
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`${NORTH_DOCK.name} archived`)).toBeInTheDocument()
  expect(screen.getByText('Find it under Archived to reactivate it.')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('complementary', { name: NORTH_DOCK.name })).not.toBeInTheDocument(),
  )

  // A pointer press on a toast starts sonner's swipe handling, which needs pointer capture jsdom
  // lacks; a plain click is what the action button reacts to.
  fireEvent.click(screen.getByRole('button', { name: 'View' }))

  expect(router.state.location.search).toMatchObject({
    checkpointId: `dock:${NORTH_DOCK.id}`,
    status: 'all',
  })
  const details = await screen.findByRole('complementary', { name: NORTH_DOCK.name })
  expect(details).toHaveTextContent('Dock · Archived')
  expect(within(details).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
})

test('leaving the archive confirmation with Escape keeps the dock card open', async () => {
  mockDocks()
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await openDock(user, NORTH_DOCK.name, 'Available')

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await user.type(
    await screen.findByRole('textbox', { name: /comment/i }),
    'Quay closed for resurfacing',
  )
  await user.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.getByRole('complementary', { name: NORTH_DOCK.name })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ checkpointId: `dock:${NORTH_DOCK.id}` })
})
