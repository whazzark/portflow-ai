import { fireEvent, screen } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'
import { useEffect, useRef } from 'react'
import { expect, test, vi } from 'vitest'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'
import { API_BASE_URL, DOCK_ADMIN, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { weighingAreasHandler } from '@/features/weighing-areas/__tests__/support/handlers'
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
    weighingAreasHandler([]),
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

test('shows weighing-area-specific empty feedback while dock markers remain usable', async () => {
  mockDocks(DOCK_ADMIN, DOCKS, [])
  renderCheckpoints()

  expect(await screen.findByText('No weighing areas have been configured.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bêta Dock' })).toBeInTheDocument()
})

test('shows source-specific pending feedback while dock markers remain usable', async () => {
  mockDocks()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, async () => {
      await delay(100)
      return HttpResponse.json({ data: WEIGHING_AREAS })
    }),
  )
  renderCheckpoints()

  expect(await screen.findByText('Loading weighing areas…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bêta Dock' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Alpha Scale' })).toBeInTheDocument()
})

test('does not show an empty state while the selected weighing-area source is pending', async () => {
  mockDocks(DOCK_ADMIN, DOCKS, [])
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, async () => {
      await delay(250)
      return HttpResponse.json({ data: WEIGHING_AREAS })
    }),
  )

  renderCheckpoints('/checkpoints?kinds=weighing-area')

  expect(await screen.findByText('Loading weighing areas…')).toBeInTheDocument()
  expect(screen.queryByText('No weighing areas have been configured.')).not.toBeInTheDocument()
})

test('does not duplicate the empty state when only weighing areas are visible', async () => {
  mockDocks(DOCK_ADMIN, DOCKS, [])

  renderCheckpoints('/checkpoints?kinds=weighing-area')

  expect(await screen.findByText('No weighing areas have been configured.')).toBeInTheDocument()
  expect(screen.getAllByText('No weighing areas have been configured.')).toHaveLength(1)
})

test('shows a weighing-area status-specific empty state without masking other checkpoints', async () => {
  mockDocks(
    DOCK_ADMIN,
    DOCKS,
    WEIGHING_AREAS.filter((area) => area.status === 'AVAILABLE'),
  )
  renderCheckpoints(`/checkpoints?${'status=archived'}`)

  expect(
    await screen.findByText('No archived weighing areas match this filter.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retired Dock' })).toBeInTheDocument()
})

test('retries only the failed weighing-area source and replaces stale feedback', async () => {
  let attempts = 0
  mockDocks()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => {
      attempts += 1
      return attempts === 1
        ? HttpResponse.json({ error: { code: 'E_WEIGHING_AREAS_UNAVAILABLE' } }, { status: 503 })
        : HttpResponse.json({ data: WEIGHING_AREAS })
    }),
  )

  renderCheckpoints()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Unable to load weighing areas.')
  expect(screen.getByRole('button', { name: 'Bêta Dock' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('button', { name: 'Alpha Scale' })).toBeInTheDocument()
  expect(screen.queryByText('Unable to load weighing areas.')).not.toBeInTheDocument()
  expect(attempts).toBe(2)
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
    weighingAreasHandler(WEIGHING_AREAS),
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

test('keeps weighing-area markers selectable when the basemap fails', async () => {
  mockDocks()
  renderCheckpoints()

  const marker = await screen.findByRole('button', { name: 'Alpha Scale' })
  fireEvent.click(marker)
  expect(await screen.findByRole('heading', { name: 'Alpha Scale' })).toBeInTheDocument()
})
