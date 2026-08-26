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

const ALPHA_SCALE = WEIGHING_AREAS[0]

async function openEditWeighingArea(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await screen.findByRole('heading', { name: 'Edit weighing area' })
}

test('offers editing on an available weighing area and pre-fills the current values', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditWeighingArea(user)

  expect(screen.getByRole('textbox', { name: 'Weighing area name' })).toHaveValue(ALPHA_SCALE.name)
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(ALPHA_SCALE.latitude),
  )
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(ALPHA_SCALE.longitude),
  )
})

test('keeps checkpoint selection while entering edit mode', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await openEditWeighingArea(user)

  expect(router.state.location.search).toMatchObject({
    checkpoint: `weighing-area:${ALPHA_SCALE.id}`,
    edit: 'weighing-area',
  })
})

test('saves a rename without touching position, status, identity, or creation time', async () => {
  const user = userEvent.setup()
  const updated: WeighingAreaDto = {
    ...ALPHA_SCALE,
    name: 'Alpha Scale Renamed',
    updatedAt: '2026-08-24T00:00:00.000Z',
  }
  let currentAreas = WEIGHING_AREAS

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () => {
      currentAreas = currentAreas.map((area) => (area.id === ALPHA_SCALE.id ? updated : area))
      return HttpResponse.json({ data: updated })
    }),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
  )

  renderCheckpoints()

  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.type(nameInput, updated.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area updated')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: updated.name })).toBeInTheDocument()
  expect(screen.getByText(String(ALPHA_SCALE.latitude))).toBeInTheDocument()
  expect(screen.getByText(String(ALPHA_SCALE.longitude))).toBeInTheDocument()
})

test('applies a combined name and position change together', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const updated: WeighingAreaDto = {
    ...ALPHA_SCALE,
    name: 'Repositioned Scale',
    latitude: ALPHA_SCALE.latitude + 1,
    longitude: ALPHA_SCALE.longitude + 1,
  }

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ data: updated })
    }),
  )

  renderCheckpoints()

  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.type(nameInput, updated.name)

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))
  expect(await screen.findByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(updated.latitude),
  )

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area updated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({
    name: updated.name,
    latitude: updated.latitude,
    longitude: updated.longitude,
  })
})

test('allows saving with no changes and does not report a duplicate', async () => {
  const user = userEvent.setup()

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () =>
      HttpResponse.json({ data: ALPHA_SCALE }),
    ),
  )

  renderCheckpoints()

  await openEditWeighingArea(user)

  const saveButton = screen.getByRole('button', { name: 'Save changes' })
  expect(saveButton).toBeEnabled()

  await user.click(saveButton)

  expect(await screen.findByText('Weighing area updated')).toBeInTheDocument()
  expect(screen.queryByText(/already in use/i)).not.toBeInTheDocument()
})

test('does not widen the kinds or status filter on a successful update', async () => {
  const user = userEvent.setup()

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () =>
      HttpResponse.json({ data: ALPHA_SCALE }),
    ),
  )

  const { router } = renderCheckpoints('/checkpoints?kinds=weighing-area&status=available')

  await openEditWeighingArea(user)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area updated')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    kinds: 'weighing-area',
    status: 'available',
  })
})
