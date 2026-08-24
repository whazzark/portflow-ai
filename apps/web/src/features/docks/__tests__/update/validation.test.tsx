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
const BETA_DOCK = DOCKS[0]

async function openEditDock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit dock' }))
  await screen.findByRole('heading', { name: 'Edit dock' })
}

test('rejects a blank dock name with an inline field error and preserves the position', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Dock name is required.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(String(NORTH_DOCK.latitude))
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(NORTH_DOCK.longitude),
  )
})

test('rejects a whitespace-only dock name', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.type(nameInput, '   ')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Dock name is required.')).toBeInTheDocument()
})

test('rejects an over-long dock name without saving', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.click(nameInput)
  await user.paste('a'.repeat(256))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(nameInput).toHaveAttribute('aria-invalid', 'true'))
  expect(screen.queryByText('Dock updated')).not.toBeInTheDocument()
})

test('rejects a manually edited out-of-range coordinate and disables submission', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditDock(user)

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '91')

  expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled())
})

test('rejects a non-numeric coordinate', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditDock(user)

  const longitudeInput = screen.getByRole('textbox', { name: 'Longitude' })
  await user.clear(longitudeInput)
  await user.type(longitudeInput, 'abc')

  expect(await screen.findByText('Longitude must be a number.')).toBeInTheDocument()
})

test('rejects a duplicate dock name inline on the name field and keeps entered values', async () => {
  const user = userEvent.setup()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, () =>
      HttpResponse.json(
        { error: { code: 'E_DOCK_NAME_CONFLICT', message: 'Dock name is already in use' } },
        { status: 409 },
      ),
    ),
  )
  renderCheckpoints()
  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.type(nameInput, BETA_DOCK.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Dock name is already in use')).toBeInTheDocument()
  expect(nameInput).toHaveValue(BETA_DOCK.name)
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(String(NORTH_DOCK.latitude))
})

test('recovers from a rejected submission by correcting and resubmitting without reopening', async () => {
  const user = userEvent.setup()
  let callCount = 0

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}`, () => {
      callCount += 1
      if (callCount === 1) {
        return HttpResponse.json(
          { error: { code: 'E_DOCK_NAME_CONFLICT', message: 'Dock name is already in use' } },
          { status: 409 },
        )
      }
      return HttpResponse.json({ data: { ...NORTH_DOCK, name: 'Corrected Dock' } })
    }),
  )

  renderCheckpoints()
  await openEditDock(user)

  const nameInput = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(nameInput)
  await user.type(nameInput, BETA_DOCK.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Dock name is already in use')).toBeInTheDocument()

  await user.clear(nameInput)
  await user.type(nameInput, 'Corrected Dock')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Dock updated')).toBeInTheDocument()
})
