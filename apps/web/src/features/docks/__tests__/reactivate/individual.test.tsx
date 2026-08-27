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

test('offers reactivating on an archived dock to an administrator, and no edit action', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, RETIRED_DOCK.name, 'Archived')

  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('offers edit and archive, but not reactivate, on an available dock', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, NORTH_DOCK.name, 'Available')

  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('does not offer reactivating to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints()

  await openDock(user, RETIRED_DOCK.name, 'Archived')

  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('reactivates a dock with a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const reactivated = {
    ...RETIRED_DOCK,
    status: 'AVAILABLE' as const,
    reactivatedAt: '2026-08-24T00:00:00.000Z',
    reactivationComment: 'Quay reopened after resurfacing',
  }
  let currentDocks = DOCKS

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${RETIRED_DOCK.id}/reactivate`, async ({ request }) => {
      capturedBody = await request.json()
      currentDocks = currentDocks.map((dock) => (dock.id === RETIRED_DOCK.id ? reactivated : dock))
      return HttpResponse.json({ data: reactivated })
    }),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
  )

  renderCheckpoints()
  await openDock(user, RETIRED_DOCK.name, 'Archived')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate dock?' })
  await user.type(
    screen.getByRole('textbox', { name: /comment/i }),
    'Quay reopened after resurfacing',
  )
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Dock “${RETIRED_DOCK.name}” reactivated`)).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Quay reopened after resurfacing' })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument(),
  )
})

test('reactivates a dock without a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const reactivated = { ...RETIRED_DOCK, status: 'AVAILABLE' as const }

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${RETIRED_DOCK.id}/reactivate`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ data: reactivated })
    }),
  )

  renderCheckpoints()
  await openDock(user, RETIRED_DOCK.name, 'Archived')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate dock?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText(`Dock “${RETIRED_DOCK.name}” reactivated`)).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: null })
})

test('shows a failure toast with the parsed API message when reactivation fails', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${RETIRED_DOCK.id}/reactivate`, () =>
      HttpResponse.json(
        { error: { code: 'E_DOCK_ALREADY_AVAILABLE', message: 'Dock is already available' } },
        { status: 409 },
      ),
    ),
  )

  renderCheckpoints()
  await openDock(user, RETIRED_DOCK.name, 'Archived')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate dock?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText(`Unable to reactivate dock “${RETIRED_DOCK.name}”`),
  ).toBeInTheDocument()
  expect(screen.getByText('Dock is already available')).toBeInTheDocument()
})
