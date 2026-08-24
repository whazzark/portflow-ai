import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import type { DockDto } from '@/features/docks/types'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

const BETA_DOCK = DOCKS[0]
const NORTH_DOCK = DOCKS[1]

type TestRouter = ReturnType<typeof renderCheckpoints>['router']

async function openEditDock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit dock' }))
  await screen.findByRole('heading', { name: 'Edit dock' })
}

/**
 * Serves whatever `docks` returns, so a test can change the list under an open edit session the
 * way another administrator's concurrent write would. The list query has no `staleTime`, so any
 * refetch — window focus, an invalidation — brings that change in mid-edit.
 */
function mockConcurrentDocks(docks: () => DockDto[]) {
  server.use(http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: docks() })))
}

async function refetchDocks(router: TestRouter) {
  await act(() =>
    router.options.context.queryClient.refetchQueries({ queryKey: dockQueries.list().queryKey }),
  )
}

/** Waits until the refetched dock has actually reached the open edit panel. */
async function waitForEditedDockName(name: string) {
  await waitFor(() =>
    expect(document.querySelector('[data-slot="sheet-description"]')).toHaveTextContent(name),
  )
}

test('drops edit mode when a status filter change drops the selection it belonged to', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await openEditDock(user)

  // The edit sheet is not modal, so the filters stay reachable while editing.
  await user.click(screen.getByRole('button', { name: /Filter checkpoints:/ }))
  await user.click(await screen.findByRole('menuitemradio', { name: /^Archived/ }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ status: 'archived' }))
  expect(router.state.location.search).not.toMatchObject({ edit: 'dock' })
})

test('does not re-arm edit mode on the next dock selected after the edited one disappears', async () => {
  const user = userEvent.setup()
  let currentDocks = DOCKS
  mockConcurrentDocks(() => currentDocks)

  const { router } = renderCheckpoints()

  await openEditDock(user)

  currentDocks = DOCKS.filter((dock) => dock.id !== NORTH_DOCK.id)
  await refetchDocks(router)

  await waitFor(() => expect(router.state.location.search).not.toMatchObject({ edit: 'dock' }))

  await user.click(
    await screen.findByRole('button', { name: `View dock ${BETA_DOCK.name} (Available)` }),
  )

  // The next dock opens for viewing, not with the map armed to move it.
  expect(await screen.findByRole('heading', { name: BETA_DOCK.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit dock' })).not.toBeInTheDocument()
})

test('hides the create control while an edit session is armed', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'New dock' })

  await openEditDock(user)

  expect(screen.queryByRole('button', { name: 'New dock' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Back to dock details' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByRole('button', { name: 'New dock' })).toBeInTheDocument()
})

test('does not report a concurrent move by someone else as an unsaved position change', async () => {
  const user = userEvent.setup()
  // Renamed as well as moved, so the test can tell when the concurrent write has reached the
  // panel: the dock being edited is not on the map, so its position alone leaves no visible trace.
  const moved: DockDto = {
    ...NORTH_DOCK,
    name: 'North Dock (relocated)',
    latitude: NORTH_DOCK.latitude + 5,
    longitude: NORTH_DOCK.longitude + 5,
  }
  let currentDocks = DOCKS
  mockConcurrentDocks(() => currentDocks)

  const { router } = renderCheckpoints()

  await openEditDock(user)
  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()

  currentDocks = DOCKS.map((dock) => (dock.id === NORTH_DOCK.id ? moved : dock))
  await refetchDocks(router)
  await waitForEditedDockName(moved.name)

  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(String(NORTH_DOCK.latitude))
})

test('restores the position this edit session started from, not a concurrent move', async () => {
  const user = userEvent.setup()
  // Renamed as well as moved, so the test can tell when the concurrent write has reached the
  // panel: the dock being edited is not on the map, so its position alone leaves no visible trace.
  const moved: DockDto = {
    ...NORTH_DOCK,
    name: 'North Dock (relocated)',
    latitude: NORTH_DOCK.latitude + 5,
    longitude: NORTH_DOCK.longitude + 5,
  }
  let currentDocks = DOCKS
  mockConcurrentDocks(() => currentDocks)

  const { router } = renderCheckpoints()

  await openEditDock(user)

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))
  expect(await screen.findByText('Position modified')).toBeInTheDocument()

  currentDocks = DOCKS.map((dock) => (dock.id === NORTH_DOCK.id ? moved : dock))
  await refetchDocks(router)
  await waitForEditedDockName(moved.name)

  await user.click(screen.getByRole('button', { name: 'Restore original position' }))

  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(
      String(NORTH_DOCK.latitude),
    ),
  )
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(NORTH_DOCK.longitude),
  )
  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()
})
