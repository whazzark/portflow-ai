import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import type { DockDto } from '@/features/docks/types'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

const NORTH_DOCK = DOCKS[1]

async function openEditDock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await screen.findByRole('heading', { name: 'Edit dock' })
}

test('offers editing on an available dock and pre-fills the current values', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditDock(user)

  expect(screen.getByRole('textbox', { name: 'Dock name' })).toHaveValue(NORTH_DOCK.name)
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(String(NORTH_DOCK.latitude))
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(NORTH_DOCK.longitude),
  )
})

test('keeps checkpoint selection while entering edit mode', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await openEditDock(user)

  expect(router.state.location.search).toMatchObject({
    checkpointId: `dock:${NORTH_DOCK.id}`,
    edit: 'dock',
  })
})

test('saves a rename without touching position, status, identity, or creation time', async () => {
  const user = userEvent.setup()
  const updated: DockDto = {
    ...NORTH_DOCK,
    name: 'Northern Dock',
    updatedAt: '2026-08-24T00:00:00.000Z',
  }
  let currentDocks = DOCKS

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, () => {
      currentDocks = currentDocks.map((dock) => (dock.id === NORTH_DOCK.id ? updated : dock))
      return HttpResponse.json({ data: updated })
    }),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
  )

  renderCheckpoints()

  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.type(nameInput, updated.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText(`Dock “${updated.name}” updated`)).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: updated.name })).toBeInTheDocument()
  expect(screen.getByText(String(NORTH_DOCK.latitude))).toBeInTheDocument()
  expect(screen.getByText(String(NORTH_DOCK.longitude))).toBeInTheDocument()
})

test('applies a combined name and position change together', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const updated: DockDto = {
    ...NORTH_DOCK,
    name: 'Repositioned Dock',
    latitude: NORTH_DOCK.latitude + 1,
    longitude: NORTH_DOCK.longitude + 1,
  }

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ data: updated })
    }),
  )

  renderCheckpoints()

  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.type(nameInput, updated.name)

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))
  expect(await screen.findByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(updated.latitude),
  )

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText(`Dock “${updated.name}” updated`)).toBeInTheDocument()
  expect(capturedBody).toMatchObject({
    name: updated.name,
    latitude: updated.latitude,
    longitude: updated.longitude,
  })
})

test('allows saving with no changes and does not report a duplicate', async () => {
  const user = userEvent.setup()

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, () =>
      HttpResponse.json({ data: NORTH_DOCK }),
    ),
  )

  renderCheckpoints()

  await openEditDock(user)

  const saveButton = screen.getByRole('button', { name: 'Save changes' })
  expect(saveButton).toBeEnabled()

  await user.click(saveButton)

  expect(await screen.findByText(`Dock “${NORTH_DOCK.name}” updated`)).toBeInTheDocument()
  expect(screen.queryByText(/already in use/i)).not.toBeInTheDocument()
})
