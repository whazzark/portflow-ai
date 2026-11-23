import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCK_OBSERVER, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { formatDateTime } from '@/helpers/dates'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

function card(name: string) {
  return screen.findByRole('complementary', { name })
}

test('opens an available dock in a card anchored to its marker', async () => {
  renderCheckpoints()
  fireEvent.click(await screen.findByRole('button', { name: 'View dock Bêta Dock (Available)' }))

  const details = await card('Bêta Dock')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(details).toHaveTextContent('Dock · Available')
  expect(within(details).getByText('GPS location')).toBeInTheDocument()
  expect(within(details).getByText('48.8566, 2.3522')).toBeInTheDocument()
  expect(details).toHaveTextContent(
    `Updated ${formatDateTime('2026-01-02T00:00:00.000Z')} · created ${formatDateTime('2025-01-01T00:00:00.000Z')}`,
  )
  expect(within(details).getByText('Returned to service')).toBeInTheDocument()
  expect(within(details).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(details).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  expect(within(details).queryByRole('heading', { name: 'Discharges' })).not.toBeInTheDocument()
})

test('opens an archived dock with its archive note and only Reactivate', async () => {
  renderCheckpoints()
  fireEvent.click(await screen.findByRole('button', { name: 'View dock Retired Dock (Archived)' }))

  const details = await card('Retired Dock')
  expect(details).toHaveTextContent('Dock · Archived')
  expect(details).toHaveTextContent(
    `Archived on ${formatDateTime('2026-03-01T00:00:00.000Z')}. It can’t be selected for new discharges; past discharges keep it.`,
  )
  expect(within(details).getByText('No longer used')).toBeInTheDocument()
  expect(within(details).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(within(details).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(within(details).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('reports no lifecycle context when the collection record has no history', async () => {
  renderCheckpoints()
  fireEvent.click(await screen.findByRole('button', { name: 'View dock North Dock (Available)' }))

  const details = await card('North Dock')
  expect(within(details).queryByRole('heading', { name: /context$/ })).not.toBeInTheDocument()
  expect(within(details).queryByText('Not specified')).not.toBeInTheDocument()
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
    await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' }),
  )

  const details = await card('Alpha Scale')
  expect(details).toHaveTextContent('Weighing area · Available')
  expect(within(details).getByText('-90.0000, 180.0000')).toBeInTheDocument()
  expect(collectionRequests).toBe(1)
})

test('keeps archived weighing-area details consultable with lifecycle metadata', async () => {
  renderCheckpoints()
  fireEvent.click(
    await screen.findByRole('button', { name: 'View weighing area Retired Scale (Archived)' }),
  )

  const details = await card('Retired Scale')
  expect(details).toHaveTextContent('Weighing area · Archived')
  expect(within(details).getByText('Retired')).toBeInTheDocument()
  expect(within(details).getByText('90.0000, -180.0000')).toBeInTheDocument()
})

test('offers no management action to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints()
  fireEvent.click(await screen.findByRole('button', { name: 'View dock Bêta Dock (Available)' }))

  const details = await card('Bêta Dock')
  expect(within(details).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(within(details).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('closes from Close, from Escape and from a click on the empty map', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  const marker = await screen.findByRole('button', { name: 'View dock Bêta Dock (Available)' })

  await user.click(marker)
  await user.click(within(await card('Bêta Dock')).getByRole('button', { name: 'Close' }))
  expect(router.state.location.search).not.toHaveProperty('checkpointId')

  await user.click(marker)
  expect(await card('Bêta Dock')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Bêta Dock' })).toHaveFocus()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('checkpointId'))

  await user.click(marker)
  expect(await card('Bêta Dock')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Simulate click on empty map' }))
  await waitFor(() =>
    expect(screen.queryByRole('complementary', { name: 'Bêta Dock' })).not.toBeInTheDocument(),
  )
})

test('copies the coordinates and confirms it', async () => {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  renderCheckpoints()
  await user.click(await screen.findByRole('button', { name: 'View dock Bêta Dock (Available)' }))

  await user.click(
    within(await card('Bêta Dock')).getByRole('button', { name: 'Copy coordinates' }),
  )

  expect(writeText).toHaveBeenCalledWith('48.8566, 2.3522')
  expect(await screen.findByText('Coordinates copied')).toBeInTheDocument()
})

test('closes the card when a filter hides its checkpoint', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await user.click(await screen.findByRole('button', { name: 'View dock Bêta Dock (Available)' }))
  expect(await card('Bêta Dock')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Docks/ }))

  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('checkpointId'))
  expect(screen.queryByRole('complementary', { name: 'Bêta Dock' })).not.toBeInTheDocument()
})

test('clears stale and status-excluded dock selections instead of showing fallback details', async () => {
  const stale = renderCheckpoints('/checkpoints?checkpoint=dock:missing')
  await screen.findByRole('region', { name: 'Checkpoint map' })
  await waitFor(() => expect(stale.router.state.location.search).not.toHaveProperty('checkpoint'))
  expect(screen.queryByRole('complementary', { name: /Dock|Scale/ })).not.toBeInTheDocument()
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
  expect(screen.queryByRole('complementary', { name: /Dock|Scale/ })).not.toBeInTheDocument()
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

test('clears malformed selections even when weighing areas fail to load', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ error: { code: 'E_WEIGHING_AREAS_UNAVAILABLE' } }, { status: 503 }),
    ),
  )

  const result = renderCheckpoints('/checkpoints?checkpoint=unknown:missing')
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await waitFor(() => expect(result.router.state.location.search).not.toHaveProperty('checkpoint'))
  expect(screen.queryByRole('complementary', { name: /Dock|Scale/ })).not.toBeInTheDocument()
})

test('hides the card while a search keeps its checkpoint off the map', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await user.click(await screen.findByRole('button', { name: 'View dock North Dock (Available)' }))
  expect(await card('North Dock')).toBeInTheDocument()

  await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'beta')
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('complementary', { name: 'North Dock' })).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    checkpointId: expect.stringMatching(/^dock:/),
  })

  await user.click(screen.getByRole('button', { name: 'Clear search checkpoints input' }))
  expect(await card('North Dock')).toBeInTheDocument()
})
