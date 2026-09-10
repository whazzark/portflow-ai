import { screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

/**
 * The selected checkpoint is named `checkpointId`, as every other route names the record it has
 * open. The former `checkpoint` is still honoured, because links to it are already in circulation
 * — bookmarked, pasted into a message — and a renamed parameter that silently opened nothing
 * would look like the checkpoint had been deleted.
 */

test('opens the checkpoint named by the current parameter', async () => {
  const dock = DOCKS[0]
  mockDocks()

  renderCheckpoints(`/checkpoints?checkpointId=dock:${dock.id}`)

  expect(await screen.findByRole('heading', { name: dock.name })).toBeInTheDocument()
})

test('honours a legacy `checkpoint` link and rewrites it to `checkpointId`', async () => {
  const dock = DOCKS[0]
  mockDocks()

  const { router } = renderCheckpoints(`/checkpoints?checkpoint=dock:${dock.id}`)

  expect(await screen.findByRole('heading', { name: dock.name })).toBeInTheDocument()
  // Rewritten rather than merely honoured, so the stale name never propagates from a link the
  // user copies back out of the address bar.
  await waitFor(() => {
    expect(router.state.location.search).toMatchObject({ checkpointId: `dock:${dock.id}` })
    expect(router.state.location.search).not.toHaveProperty('checkpoint')
  })
})
