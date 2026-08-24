import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCK_OBSERVER, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const NORTH_DOCK = DOCKS[1]
const RETIRED_DOCK = DOCKS[2]

test('does not offer editing to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await screen.findByRole('heading', { name: NORTH_DOCK.name })

  expect(screen.queryByRole('button', { name: 'Edit dock' })).not.toBeInTheDocument()
})

test('does not offer editing an archived dock, even to an administrator', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` }),
  )
  await screen.findByRole('heading', { name: RETIRED_DOCK.name })

  expect(screen.queryByRole('button', { name: 'Edit dock' })).not.toBeInTheDocument()
  expect(screen.getByText('Archived docks cannot receive new operations.')).toBeInTheDocument()
})

test('ignores a direct edit=dock URL for a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints(`/checkpoints?checkpoint=dock:${NORTH_DOCK.id}&edit=dock`)

  expect(await screen.findByRole('heading', { name: NORTH_DOCK.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit dock' })).not.toBeInTheDocument()
})

test('ignores a direct edit=dock URL for an archived dock', async () => {
  mockDocks()
  renderCheckpoints(`/checkpoints?checkpoint=dock:${RETIRED_DOCK.id}&edit=dock`)

  expect(await screen.findByRole('heading', { name: RETIRED_DOCK.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit dock' })).not.toBeInTheDocument()
})

test('keeps the form open and names reactivation when the dock was archived mid-edit', async () => {
  mockDocks()
  const user = userEvent.setup()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, () =>
      HttpResponse.json(
        { error: { code: 'E_DOCK_ARCHIVED', message: 'Archived docks are read-only' } },
        { status: 409 },
      ),
    ),
  )
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit dock' }))
  await screen.findByRole('heading', { name: 'Edit dock' })

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText(/reactivate the dock/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit dock' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Dock name' })).toHaveValue(NORTH_DOCK.name)
})

test('exits edit mode and clears the selection when the dock is no longer found', async () => {
  mockDocks()
  const user = userEvent.setup()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, () =>
      HttpResponse.json(
        { error: { code: 'E_DOCK_NOT_FOUND', message: 'Dock not found' } },
        { status: 404 },
      ),
    ),
  )
  const { router } = renderCheckpoints()

  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit dock' }))
  await screen.findByRole('heading', { name: 'Edit dock' })

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Edit dock' })).not.toBeInTheDocument(),
  )
  expect((router.state.location.search as { checkpoint?: string }).checkpoint).toBeUndefined()
  expect((router.state.location.search as { edit?: string }).edit).toBeUndefined()
})
