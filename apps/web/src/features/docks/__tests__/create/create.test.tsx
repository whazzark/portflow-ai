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

test('places, names, and creates a dock, then shows it as the selected read-only detail', async () => {
  const user = userEvent.setup()
  const created: DockDto = {
    id: 'created-dock-1',
    name: 'South Dock',
    latitude: 10.5,
    longitude: 20.5,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  }
  let currentDocks = DOCKS

  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks`, () => {
      currentDocks = [...currentDocks, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
  )

  const { router } = renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  await user.type(screen.getByRole('textbox', { name: 'Dock name' }), created.name)
  await user.click(screen.getByRole('button', { name: 'Create dock' }))

  expect(await screen.findByText('Dock created')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: created.name })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    checkpoint: `dock:${created.id}`,
  })
  expect((router.state.location.search as { create?: string }).create).toBeUndefined()

  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(
    await screen.findByRole('button', { name: `View dock ${created.name} (Available)` }),
  ).toBeInTheDocument()
})

test('reveals the new dock even when the active filters would hide it', async () => {
  const user = userEvent.setup()
  const created: DockDto = {
    id: 'created-dock-3',
    name: 'Filtered Dock',
    latitude: 10.5,
    longitude: 20.5,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  }
  let currentDocks = DOCKS

  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks`, () => {
      currentDocks = [...currentDocks, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
  )

  // Both filters would exclude a brand new dock: it is AVAILABLE, and it is a dock.
  const hidingFilters = new URLSearchParams({ status: 'archived', kinds: 'weighing-area' })
  const { router } = renderCheckpoints(`/checkpoints?${hidingFilters}`)

  await user.click(await screen.findByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Dock name' }), created.name)
  await user.click(screen.getByRole('button', { name: 'Create dock' }))

  expect(await screen.findByRole('heading', { name: created.name })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    checkpoint: `dock:${created.id}`,
    status: 'available',
  })
  expect((router.state.location.search as { kinds?: string }).kinds).toBeUndefined()
})

test('creates a dock by typing coordinates directly, without any map click (keyboard-only path)', async () => {
  const user = userEvent.setup()
  const created: DockDto = {
    id: 'created-dock-2',
    name: 'Keyboard Dock',
    latitude: 12,
    longitude: 34,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks`, () =>
      HttpResponse.json({ data: created }, { status: 201 }),
    ),
  )

  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))

  expect(screen.getByRole('button', { name: 'Create dock' })).toBeDisabled()

  await user.type(screen.getByRole('textbox', { name: 'Dock name' }), created.name)
  await user.type(screen.getByRole('textbox', { name: 'Latitude' }), String(created.latitude))
  await user.type(screen.getByRole('textbox', { name: 'Longitude' }), String(created.longitude))

  expect(screen.getByRole('button', { name: 'Create dock' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Create dock' }))

  expect(await screen.findByText('Dock created')).toBeInTheDocument()
})
