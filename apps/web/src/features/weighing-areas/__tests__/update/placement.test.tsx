import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
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

async function openEditWeighingArea(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit weighing area' }))
  await screen.findByRole('heading', { name: 'Edit weighing area' })
}

test('replaces the weighing area marker with a labelled draft marker while editing', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditWeighingArea(user)

  expect(
    screen.queryByRole('button', { name: `View weighing area ${ALPHA_SCALE.name} (Available)` }),
  ).not.toBeInTheDocument()
  expect(screen.getByTestId('pending-checkpoint-marker')).toHaveTextContent(ALPHA_SCALE.name)
})

test('drags the draft marker and saves the final dragged position', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ data: ALPHA_SCALE })
    }),
  )

  renderCheckpoints()

  await openEditWeighingArea(user)

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))

  expect(await screen.findByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(ALPHA_SCALE.latitude + 1),
  )
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(ALPHA_SCALE.longitude + 1),
  )

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(capturedBody).toMatchObject({
      latitude: ALPHA_SCALE.latitude + 1,
      longitude: ALPHA_SCALE.longitude + 1,
    }),
  )
})

test('typing coordinates moves the draft marker', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditWeighingArea(user)

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '10')

  await waitFor(() =>
    expect(screen.getByTestId('pending-checkpoint-marker')).toHaveTextContent(
      `${ALPHA_SCALE.name} at 10,`,
    ),
  )
})

test('shows a restore control once the position changes, and restoring it does not clear the name', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await openEditWeighingArea(user)

  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.type(nameInput, 'Renamed while dragging')

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))

  expect(await screen.findByText('Position modified')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Restore original position' }))

  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(
      String(ALPHA_SCALE.latitude),
    ),
  )
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(ALPHA_SCALE.longitude),
  )
  expect(screen.queryByText('Position modified')).not.toBeInTheDocument()
  expect(nameInput).toHaveValue('Renamed while dragging')
})
