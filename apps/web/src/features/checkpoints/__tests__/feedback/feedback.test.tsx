import { fireEvent, screen } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'
import { useEffect, useRef } from 'react'
import { expect, test, vi } from 'vitest'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'
import { API_BASE_URL, DOCK_ADMIN, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock('@/features/checkpoints/map/checkpoint-map', () => ({
  CheckpointMap({
    checkpoints,
    onError,
    onSelect,
  }: {
    checkpoints: PresentedCheckpoint[]
    onError?: (error: Error) => void
    onSelect: (checkpoint: PresentedCheckpoint) => void
  }) {
    const hasReportedError = useRef(false)
    useEffect(() => {
      if (hasReportedError.current) {
        return
      }
      hasReportedError.current = true
      onError?.(new Error('Style failed'))
    }, [onError])
    return (
      <section aria-label="Checkpoint map">
        {checkpoints.map((checkpoint) => (
          <button key={checkpoint.id} onClick={() => onSelect(checkpoint)} type="button">
            {checkpoint.name}
          </button>
        ))}
      </section>
    )
  },
}))

test('distinguishes route loading from an empty collection', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: DOCK_ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, async () => {
      await delay(2500)
      return HttpResponse.json({ data: [] })
    }),
  )

  renderCheckpoints()
  expect(
    await screen.findByRole('main', { name: 'Loading checkpoints' }, { timeout: 6000 }),
  ).toBeInTheDocument()
  expect(await screen.findByText('No checkpoints have been configured.')).toBeInTheDocument()
})

test('uses status-specific copy when a filter has no docks', async () => {
  mockDocks(
    DOCK_ADMIN,
    DOCKS.filter((dock) => dock.status === 'AVAILABLE'),
  )
  renderCheckpoints(`/checkpoints?${'status=archived'}`)

  expect(await screen.findByText('No archived checkpoints match this filter.')).toBeInTheDocument()
})

test('retries a failed collection request and recovers', async () => {
  let attempts = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: DOCK_ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => {
      attempts += 1
      return attempts === 1
        ? HttpResponse.json({ error: { code: 'E_DOCKS_UNAVAILABLE' } }, { status: 503 })
        : HttpResponse.json({ data: DOCKS })
    }),
  )

  renderCheckpoints()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load checkpoints')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('status', { name: 'Checkpoint map unavailable' }),
  ).toBeInTheDocument()
})

test('shows map-specific feedback without restoring a dock list when the basemap fails', async () => {
  mockDocks()
  renderCheckpoints()

  expect(
    await screen.findByRole('status', { name: 'Checkpoint map unavailable' }),
  ).toHaveTextContent('The map background is currently unavailable')
  expect(screen.queryByRole('table', { name: 'Docks' })).not.toBeInTheDocument()
})

test('keeps checkpoint markers selectable when the basemap fails', async () => {
  mockDocks()
  renderCheckpoints()

  const marker = await screen.findByRole('button', { name: 'Bêta Dock' })
  expect(marker).toBeInTheDocument()
  fireEvent.click(marker)
  expect(await screen.findByRole('heading', { name: 'Bêta Dock' })).toBeInTheDocument()
})
