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

test('blocks submission with a clear message until a location has been placed', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))

  expect(
    screen.getByText('A location must be placed before this dock can be created.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create dock' })).toBeDisabled()
})

test('rejects a blank dock name with an inline field error and keeps the pending placement', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  await user.click(screen.getByRole('button', { name: 'Create dock' }))

  expect(await screen.findByText('Dock name is required.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
})

test('rejects a duplicate dock name inline on the name field and keeps entered values', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks`, () =>
      HttpResponse.json(
        { error: { code: 'E_DOCK_NAME_CONFLICT', message: 'Dock name is already in use' } },
        { status: 409 },
      ),
    ),
  )
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Dock name' }), DOCKS[1].name)
  await user.click(screen.getByRole('button', { name: 'Create dock' }))

  expect(await screen.findByText('Dock name is already in use')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Dock name' })).toHaveValue(DOCKS[1].name)
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
})

test('rejects a manually edited out-of-range coordinate and disables submission', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Dock name' }), 'South Dock')

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '91')

  expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create dock' })).toBeDisabled())
})
