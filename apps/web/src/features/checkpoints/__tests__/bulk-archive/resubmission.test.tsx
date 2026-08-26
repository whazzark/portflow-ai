import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import type { DockDto } from '@/features/docks/types'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const BETA_DOCK = DOCKS[0]
const NORTH_DOCK = DOCKS[1]

test('resubmitting after a partial success does not re-touch the already-archived dock', async () => {
  const user = userEvent.setup()
  let currentDocks = DOCKS
  const capturedBodies: unknown[] = []

  mockDocks()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
    http.post(`${API_BASE_URL}/api/v1/docks/archive`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      capturedBodies.push(body)

      if (body.ids.includes(BETA_DOCK.id)) {
        const archivedBeta: DockDto = { ...BETA_DOCK, status: 'ARCHIVED' }
        currentDocks = currentDocks.map((dock) => (dock.id === BETA_DOCK.id ? archivedBeta : dock))
        return HttpResponse.json({
          data: {
            updatedDocks: [archivedBeta],
            blockedDocks: [{ id: NORTH_DOCK.id, name: NORTH_DOCK.name, reason: 'IN_USE' }],
          },
        })
      }

      const archivedNorth: DockDto = { ...NORTH_DOCK, status: 'ARCHIVED' }
      currentDocks = currentDocks.map((dock) => (dock.id === NORTH_DOCK.id ? archivedNorth : dock))
      return HttpResponse.json({
        data: { updatedDocks: [archivedNorth], blockedDocks: [] },
      })
    }),
  )

  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${BETA_DOCK.name}` }))
  await user.click(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }))

  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await screen.findByRole('heading', { name: 'Archive selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('1 dock archived; 1 dock unchanged')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select dock ${BETA_DOCK.name}` }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Deselect dock ${NORTH_DOCK.name}` }),
  ).toBeInTheDocument()

  // No dedicated retry control: the still-checked blocked dock is resubmitted by clicking the
  // same "Archive selected" button again.
  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await screen.findByRole('heading', { name: 'Archive selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('1 dock archived')).toBeInTheDocument()
  expect(capturedBodies).toEqual([
    { ids: [BETA_DOCK.id, NORTH_DOCK.id], comment: null },
    { ids: [NORTH_DOCK.id], comment: null },
  ])
})
