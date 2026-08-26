import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const RETIRED_SCALE = WEIGHING_AREAS[1]
const GAMMA_SCALE = WEIGHING_AREAS[3]

test('clears blocked entries and reactivates only the reduced selection on resubmission', async () => {
  const user = userEvent.setup()
  const submittedIds: string[][] = []
  // RETIRED_SCALE was reactivated by someone else a moment ago, so the first submission blocks it
  // and reactivates GAMMA_SCALE. The list then reflects that.
  let currentAreas = WEIGHING_AREAS

  mockDocks()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/reactivate`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      submittedIds.push(body.ids)

      const updated = body.ids
        .filter((id) => id !== RETIRED_SCALE.id)
        .map((id) => ({
          ...currentAreas.find((area) => area.id === id),
          status: 'AVAILABLE' as const,
        }))
      currentAreas = currentAreas.map((area) =>
        body.ids.includes(area.id) && area.id !== RETIRED_SCALE.id
          ? { ...area, status: 'AVAILABLE' as const }
          : area,
      )

      return HttpResponse.json({
        data: {
          updatedWeighingAreas: updated,
          blockedWeighingAreas: body.ids.includes(RETIRED_SCALE.id)
            ? [{ id: RETIRED_SCALE.id, name: RETIRED_SCALE.name, reason: 'ALREADY_AVAILABLE' }]
            : [],
        },
      })
    }),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')
  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  )
  await user.click(screen.getByRole('button', { name: `Select weighing area ${GAMMA_SCALE.name}` }))

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected weighing areas?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText('1 weighing area reactivated; 1 weighing area unchanged'),
  ).toBeInTheDocument()
  expect(screen.getByText(`${RETIRED_SCALE.name}: already available`)).toBeInTheDocument()
  // The whole selection is cleared, blocked entry included: neither reactivation blocker becomes
  // eligible on a retry, so keeping it checked would only invite a second refusal.
  expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
  expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  expect(submittedIds).toEqual([[RETIRED_SCALE.id, GAMMA_SCALE.id]])
})

test('a reactivated weighing area is no longer offered for a reactivation selection', async () => {
  const user = userEvent.setup()
  let currentAreas = WEIGHING_AREAS

  mockDocks()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: currentAreas }),
    ),
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/reactivate`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] }
      currentAreas = currentAreas.map((area) =>
        body.ids.includes(area.id) ? { ...area, status: 'AVAILABLE' as const } : area,
      )
      return HttpResponse.json({
        data: {
          updatedWeighingAreas: [{ ...GAMMA_SCALE, status: 'AVAILABLE' }],
          blockedWeighingAreas: [],
        },
      })
    }),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')
  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(screen.getByRole('button', { name: `Select weighing area ${GAMMA_SCALE.name}` }))
  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected weighing areas?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 weighing area reactivated')).toBeInTheDocument()
  // It left the archived filter, so it cannot be re-attempted by a second submission.
  expect(
    screen.queryByRole('button', { name: `Select weighing area ${GAMMA_SCALE.name}` }),
  ).not.toBeInTheDocument()
})
