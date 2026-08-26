import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCK_ADMIN, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import type { DockDto } from '@/features/docks/types'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const RETIRED_DOCK = DOCKS[2]

const ARCHIVED_ONE: DockDto = {
  ...RETIRED_DOCK,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Archived One',
}
const ARCHIVED_TWO: DockDto = {
  ...RETIRED_DOCK,
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Archived Two',
}
const ARCHIVED_THREE: DockDto = {
  ...RETIRED_DOCK,
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Archived Three',
}

test('a mixed reactivation empties the whole selection, and a later selection is unaffected by it', async () => {
  const user = userEvent.setup()
  let currentDocks: DockDto[] = [ARCHIVED_ONE, ARCHIVED_TWO, ARCHIVED_THREE]
  const capturedBodies: unknown[] = []

  mockDocks(DOCK_ADMIN, currentDocks)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: currentDocks })),
    http.post(`${API_BASE_URL}/api/v1/docks/reactivate`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      capturedBodies.push(body)

      if (body.ids.includes(ARCHIVED_ONE.id)) {
        const reactivatedOne: DockDto = { ...ARCHIVED_ONE, status: 'AVAILABLE' }
        currentDocks = currentDocks.map((dock) =>
          dock.id === ARCHIVED_ONE.id ? reactivatedOne : dock,
        )
        return HttpResponse.json({
          data: {
            updatedDocks: [reactivatedOne],
            blockedDocks: [
              { id: ARCHIVED_TWO.id, name: ARCHIVED_TWO.name, reason: 'ALREADY_AVAILABLE' },
            ],
          },
        })
      }

      const reactivatedThree: DockDto = { ...ARCHIVED_THREE, status: 'AVAILABLE' }
      currentDocks = currentDocks.map((dock) =>
        dock.id === ARCHIVED_THREE.id ? reactivatedThree : dock,
      )
      return HttpResponse.json({
        data: { updatedDocks: [reactivatedThree], blockedDocks: [] },
      })
    }),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${ARCHIVED_ONE.name}` }))
  await user.click(screen.getByRole('button', { name: `Select dock ${ARCHIVED_TWO.name}` }))

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 dock reactivated; 1 dock unchanged')).toBeInTheDocument()
  // Neither reactivation blocker is retryable, so nothing stays checked — the counterpart of the
  // archive path's IN_USE handling, which keeps the blocked dock checked instead (research D7).
  expect(await screen.findByText('0 selected')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Deselect dock ${ARCHIVED_TWO.name}` }),
  ).not.toBeInTheDocument()

  // A later, unrelated selection is unaffected by the prior request.
  await user.click(screen.getByRole('button', { name: `Select dock ${ARCHIVED_THREE.name}` }))
  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 dock reactivated')).toBeInTheDocument()
  expect(capturedBodies).toEqual([
    { ids: [ARCHIVED_ONE.id, ARCHIVED_TWO.id], comment: null },
    { ids: [ARCHIVED_THREE.id], comment: null },
  ])
})
