import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]

async function openWeighingArea(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  status: string,
) {
  await user.click(
    await screen.findByRole('button', { name: `View weighing area ${name} (${status})` }),
  )
  await screen.findByRole('heading', { name })
}

test('offers reactivation, and no edit action, on an archived weighing area', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await openWeighingArea(user, RETIRED_SCALE.name, 'Archived')

  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  // An archived weighing area is read-only; only its lifecycle can change.
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('offers edit and archive, and no reactivation, on an available weighing area', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openWeighingArea(user, ALPHA_SCALE.name, 'Available')

  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('reactivates an archived weighing area with a comment and reflects it without a reload', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const reactivated = {
    ...RETIRED_SCALE,
    status: 'AVAILABLE' as const,
    reactivatedAt: '2026-08-25T00:00:00.000Z',
    reactivationComment: 'Back in service after calibration',
  }
  let currentAreas = WEIGHING_AREAS

  mockDocks()
  server.use(
    http.post(
      `${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`,
      async ({ request }) => {
        capturedBody = await request.json()
        currentAreas = currentAreas.map((area) =>
          area.id === RETIRED_SCALE.id ? reactivated : area,
        )
        return HttpResponse.json({ data: reactivated })
      },
    ),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
  )

  renderCheckpoints('/checkpoints?status=all')
  await openWeighingArea(user, RETIRED_SCALE.name, 'Archived')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate weighing area?' })
  await user.type(
    screen.getByRole('textbox', { name: /comment/i }),
    'Back in service after calibration',
  )
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Weighing area reactivated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Back in service after calibration' })
  // The invalidated list query re-renders the sheet from authoritative state: the weighing area is
  // now available, so it offers editing and archiving rather than reactivation.
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('reactivates an archived weighing area without a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  mockDocks()
  server.use(
    http.post(
      `${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`,
      async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ data: { ...RETIRED_SCALE, status: 'AVAILABLE' } })
      },
    ),
  )

  renderCheckpoints('/checkpoints?status=all')
  await openWeighingArea(user, RETIRED_SCALE.name, 'Archived')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate weighing area?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Weighing area reactivated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: null })
})

test('abandoning the confirmation leaves the weighing area archived and unchanged', async () => {
  const user = userEvent.setup()
  let requested = false

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`, () => {
      requested = true
      return HttpResponse.json({ data: { ...RETIRED_SCALE, status: 'AVAILABLE' } })
    }),
  )

  renderCheckpoints('/checkpoints?status=all')
  await openWeighingArea(user, RETIRED_SCALE.name, 'Archived')

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate weighing area?' })
  await user.type(screen.getByRole('textbox', { name: /comment/i }), 'Never mind')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() =>
    expect(
      screen.queryByRole('heading', { name: 'Reactivate weighing area?' }),
    ).not.toBeInTheDocument(),
  )
  expect(requested).toBe(false)
  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
})
