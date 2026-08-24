import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

const ALPHA_SCALE = WEIGHING_AREAS[0]
const AVAILABLE_DOCK = DOCKS[1]

type TestRouter = ReturnType<typeof renderCheckpoints>['router']

async function openEditWeighingArea(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit weighing area' }))
  await screen.findByRole('heading', { name: 'Edit weighing area' })
}

/** Serves whatever `weighingAreas` returns, mimicking a concurrent write from another
 * administrator reaching this session's open edit panel via a background refetch. */
function mockConcurrentWeighingAreas(areas: () => WeighingAreaDto[]) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => HttpResponse.json({ data: areas() })),
  )
}

async function refetchWeighingAreas(router: TestRouter) {
  await act(() =>
    router.options.context.queryClient.refetchQueries({
      queryKey: weighingAreaQueries.list().queryKey,
    }),
  )
}

test('never arms the map for a dock merely selected for viewing after a weighing-area edit ends', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditWeighingArea(user)

  await user.click(screen.getByRole('button', { name: 'Back to weighing area details' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))

  await user.click(
    await screen.findByRole('button', { name: `View dock ${AVAILABLE_DOCK.name} (Available)` }),
  )

  expect(await screen.findByRole('heading', { name: AVAILABLE_DOCK.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit dock' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit weighing area' })).not.toBeInTheDocument()
})

test('drops edit mode when a status filter change drops the selection it belonged to', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await openEditWeighingArea(user)

  await user.click(screen.getByRole('button', { name: /Filter checkpoints:/ }))
  await user.click(await screen.findByRole('menuitemradio', { name: /^Archived/ }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ status: 'archived' }))
  expect(router.state.location.search).not.toMatchObject({ edit: 'weighing-area' })
})

test('hides both create controls while a weighing-area edit session is armed', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'New dock' })
  await screen.findByRole('button', { name: 'New weighing area' })

  await openEditWeighingArea(user)

  expect(screen.queryByRole('button', { name: 'New dock' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'New weighing area' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Back to weighing area details' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByRole('button', { name: 'New dock' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New weighing area' })).toBeInTheDocument()
})

test('ignores a URL whose edit kind does not match the selected checkpoint kind', async () => {
  mockDocks()
  renderCheckpoints(`/checkpoints?checkpoint=dock:${AVAILABLE_DOCK.id}&edit=weighing-area`)

  expect(await screen.findByRole('heading', { name: AVAILABLE_DOCK.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit dock' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit weighing area' })).not.toBeInTheDocument()
})

test('does not report a concurrent move by someone else as an unsaved position change', async () => {
  const user = userEvent.setup()
  const moved: WeighingAreaDto = {
    ...ALPHA_SCALE,
    name: 'Alpha Scale (relocated)',
    latitude: ALPHA_SCALE.latitude === 90 ? 89 : ALPHA_SCALE.latitude + 5,
    longitude: ALPHA_SCALE.longitude === 180 ? 179 : ALPHA_SCALE.longitude + 5,
  }
  let currentAreas = WEIGHING_AREAS
  mockConcurrentWeighingAreas(() => currentAreas)

  const { router } = renderCheckpoints()

  await openEditWeighingArea(user)
  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()

  currentAreas = WEIGHING_AREAS.map((area) => (area.id === ALPHA_SCALE.id ? moved : area))
  await refetchWeighingAreas(router)
  await waitFor(() =>
    expect(document.querySelector('[data-slot="sheet-description"]')).toHaveTextContent(moved.name),
  )

  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(ALPHA_SCALE.latitude),
  )
})
