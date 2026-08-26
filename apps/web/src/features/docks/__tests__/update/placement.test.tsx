import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

const NORTH_DOCK = DOCKS[1]

async function openEditDock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await screen.findByRole('heading', { name: 'Edit dock' })
}

test('replaces the dock marker with a labelled draft marker while editing', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditDock(user)

  expect(
    screen.queryByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  ).not.toBeInTheDocument()
  expect(screen.getByTestId('pending-checkpoint-marker')).toHaveTextContent(NORTH_DOCK.name)
})

test('drags the draft marker and saves the final dragged position', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ data: NORTH_DOCK })
    }),
  )

  renderCheckpoints()

  await openEditDock(user)

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))

  expect(await screen.findByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(NORTH_DOCK.latitude + 1),
  )
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(NORTH_DOCK.longitude + 1),
  )

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(capturedBody).toMatchObject({
      latitude: NORTH_DOCK.latitude + 1,
      longitude: NORTH_DOCK.longitude + 1,
    }),
  )
})

test('typing coordinates moves the draft marker', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditDock(user)

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '10')

  await waitFor(() =>
    expect(screen.getByTestId('pending-checkpoint-marker')).toHaveTextContent(
      `${NORTH_DOCK.name} at 10,`,
    ),
  )
})

test('shows a restore control once the position changes, and restoring it does not clear the name', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditDock(user)

  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.type(nameInput, 'Renamed while dragging')

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))

  expect(await screen.findByText('Position modified')).toBeInTheDocument()

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
  expect(nameInput).toHaveValue('Renamed while dragging')
})
