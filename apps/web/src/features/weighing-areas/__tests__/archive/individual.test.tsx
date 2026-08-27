import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCK_OBSERVER } from '@/features/docks/__tests__/support/fixtures'
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

test('offers archiving on an available weighing area to an administrator', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await openWeighingArea(user, ALPHA_SCALE.name, 'Available')

  expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('does not offer archiving to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints()

  await openWeighingArea(user, ALPHA_SCALE.name, 'Available')

  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('does not offer archiving an already archived weighing area', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await openWeighingArea(user, RETIRED_SCALE.name, 'Archived')

  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('archives a weighing area with a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const archived = {
    ...ALPHA_SCALE,
    status: 'ARCHIVED' as const,
    archivedAt: '2026-08-24T00:00:00.000Z',
    archiveComment: 'Weighbridge decommissioned',
  }
  let currentAreas = WEIGHING_AREAS

  mockDocks()
  server.use(
    http.post(
      `${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}/archive`,
      async ({ request }) => {
        capturedBody = await request.json()
        currentAreas = currentAreas.map((area) => (area.id === ALPHA_SCALE.id ? archived : area))
        return HttpResponse.json({ data: archived })
      },
    ),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
  )

  renderCheckpoints()
  await openWeighingArea(user, ALPHA_SCALE.name, 'Available')

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await screen.findByRole('heading', { name: 'Archive weighing area?' })
  await user.type(screen.getByRole('textbox', { name: /comment/i }), 'Weighbridge decommissioned')
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText(`Weighing area “${ALPHA_SCALE.name}” archived`),
  ).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Weighbridge decommissioned' })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument(),
  )
})

test('archives a weighing area without a comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown
  const archived = { ...ALPHA_SCALE, status: 'ARCHIVED' as const }

  mockDocks()
  server.use(
    http.post(
      `${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}/archive`,
      async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ data: archived })
      },
    ),
  )

  renderCheckpoints()
  await openWeighingArea(user, ALPHA_SCALE.name, 'Available')

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await screen.findByRole('heading', { name: 'Archive weighing area?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText(`Weighing area “${ALPHA_SCALE.name}” archived`),
  ).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: null })
})
