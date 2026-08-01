import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('opens collection-backed archived details from a marker', async () => {
  renderCheckpoints()
  fireEvent.click(await screen.findByRole('button', { name: 'View dock Retired Dock (Archived)' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Retired Dock' })).toBeInTheDocument()
  expect(within(dialog).getByText('No longer used')).toBeInTheDocument()
  expect(
    within(dialog).getByText('Archived docks cannot receive new operations.'),
  ).toBeInTheDocument()
})

test('opens the same collection-backed detail presentation from a marker', async () => {
  renderCheckpoints()
  fireEvent.click(await screen.findByRole('button', { name: 'View dock Bêta Dock (Available)' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Bêta Dock' })).toBeInTheDocument()
  expect(within(dialog).getByText('Returned to service')).toBeInTheDocument()
  expect(within(dialog).getByText('48.8566')).toBeInTheDocument()
  expect(within(dialog).getByText('2.3522')).toBeInTheDocument()
})

test('omits lifecycle history when the collection record has none', async () => {
  renderCheckpoints()

  fireEvent.click(await screen.findByRole('button', { name: 'View dock North Dock (Available)' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByRole('heading', { name: 'Lifecycle' })).not.toBeInTheDocument()
  expect(within(dialog).getByText('Available')).toBeInTheDocument()
})

test('opens available weighing-area details from the loaded collection without a detail request', async () => {
  let collectionRequests = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => {
      collectionRequests += 1
      return HttpResponse.json({ data: WEIGHING_AREAS })
    }),
  )
  renderCheckpoints()

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'View weighing area Alpha Scale (Available)',
    }),
  )

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Alpha Scale' })).toBeInTheDocument()
  expect(within(dialog).getByText('Available')).toBeInTheDocument()
  expect(within(dialog).getByText('-90')).toBeInTheDocument()
  expect(within(dialog).getByText('180')).toBeInTheDocument()
  expect(collectionRequests).toBe(1)
})

test('keeps archived weighing-area details consultable with lifecycle metadata', async () => {
  renderCheckpoints()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'View weighing area Retired Scale (Archived)',
    }),
  )

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Retired Scale' })).toBeInTheDocument()
  expect(within(dialog).getAllByText('Archived')).not.toHaveLength(0)
  expect(within(dialog).getByText('Retired')).toBeInTheDocument()
  expect(within(dialog).getByText('90')).toBeInTheDocument()
  expect(within(dialog).getByText('-180')).toBeInTheDocument()
})

test('clears stale and status-excluded dock selections instead of showing fallback details', async () => {
  const stale = renderCheckpoints('/checkpoints?checkpoint=dock:missing')
  await screen.findByRole('region', { name: 'Checkpoint map' })
  await waitFor(() => expect(stale.router.state.location.search).not.toHaveProperty('checkpoint'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  stale.unmount()

  const retiredDock = DOCKS.find((dock) => dock.status === 'ARCHIVED')
  expect(retiredDock).toBeDefined()
  if (!retiredDock) {
    throw new Error('Archived dock fixture is required')
  }
  const selected = renderCheckpoints(
    `/checkpoints?status=available&checkpoint=dock:${retiredDock.id}`,
  )
  await screen.findByRole('region', { name: 'Checkpoint map' })
  await waitFor(() =>
    expect(selected.router.state.location.search).not.toHaveProperty('checkpoint'),
  )
  expect(screen.queryByRole('heading', { name: 'Retired Dock' })).not.toBeInTheDocument()
})

test('clears stale and status-excluded weighing-area selections without substitution', async () => {
  const stale = renderCheckpoints('/checkpoints?checkpoint=weighing-area:missing')
  await screen.findByRole('region', { name: 'Checkpoint map' })
  await waitFor(() => expect(stale.router.state.location.search).not.toHaveProperty('checkpoint'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  stale.unmount()

  const archived = WEIGHING_AREAS.find((area) => area.status === 'ARCHIVED')
  expect(archived).toBeDefined()
  if (!archived) {
    throw new Error('Archived weighing-area fixture is required')
  }
  const selected = renderCheckpoints(
    `/checkpoints?status=available&checkpoint=weighing-area:${archived.id}`,
  )
  await screen.findByRole('region', { name: 'Checkpoint map' })
  await waitFor(() =>
    expect(selected.router.state.location.search).not.toHaveProperty('checkpoint'),
  )
  expect(screen.queryByRole('heading', { name: archived.name })).not.toBeInTheDocument()
})
