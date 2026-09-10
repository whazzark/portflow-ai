import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('arms placement, drops a pending marker, and syncs coordinate fields on click', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))

  expect(
    screen.getByRole('button', { name: 'View weighing area Alpha Scale (Available)' }),
  ).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('20.5')

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))

  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('11.5')
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('21.5')
})

test('places, names, and creates a weighing area, then shows it as the selected read-only detail', async () => {
  const user = userEvent.setup()
  const created: WeighingAreaDto = {
    id: 'created-weighing-area-1',
    name: 'South Scale',
    latitude: 10.5,
    longitude: 20.5,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
  }
  let currentAreas = WEIGHING_AREAS

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () => {
      currentAreas = [...currentAreas, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
  )

  const { router } = renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), created.name)
  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByText(`Weighing area “${created.name}” created`)).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: created.name })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    checkpointId: `weighing-area:${created.id}`,
  })
  expect((router.state.location.search as { create?: string }).create).toBeUndefined()

  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(
    await screen.findByRole('button', { name: `View weighing area ${created.name} (Available)` }),
  ).toBeInTheDocument()
})

test('reveals the new weighing area even when the active filters would hide it', async () => {
  const user = userEvent.setup()
  const created: WeighingAreaDto = {
    id: 'created-weighing-area-3',
    name: 'Filtered Scale',
    latitude: 10.5,
    longitude: 20.5,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
  }
  let currentAreas = WEIGHING_AREAS

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () => {
      currentAreas = [...currentAreas, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
  )

  // Both filters would exclude a brand new weighing area: it is AVAILABLE, and it is a weighing area.
  const hidingFilters = new URLSearchParams({ status: 'archived', kinds: 'dock' })
  const { router } = renderCheckpoints(`/checkpoints?${hidingFilters}`)

  await user.click(await screen.findByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), created.name)
  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByRole('heading', { name: created.name })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    checkpointId: `weighing-area:${created.id}`,
    status: 'available',
  })
  expect((router.state.location.search as { kinds?: string }).kinds).toBeUndefined()
})

test('creates a weighing area by typing coordinates directly, without any map click (keyboard-only path)', async () => {
  const user = userEvent.setup()
  const created: WeighingAreaDto = {
    id: 'created-weighing-area-2',
    name: 'Keyboard Scale',
    latitude: 12,
    longitude: 34,
    status: 'AVAILABLE',
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
  }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: created }, { status: 201 }),
    ),
  )

  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))

  expect(screen.getByRole('button', { name: 'Create weighing area' })).toBeDisabled()

  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), created.name)
  await user.type(screen.getByRole('textbox', { name: 'Latitude' }), String(created.latitude))
  await user.type(screen.getByRole('textbox', { name: 'Longitude' }), String(created.longitude))

  expect(screen.getByRole('button', { name: 'Create weighing area' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByText(`Weighing area “${created.name}” created`)).toBeInTheDocument()
})
