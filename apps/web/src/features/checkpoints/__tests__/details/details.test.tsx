import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { DOCKS } from '@/features/docks/__tests__/support/fixtures'
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
