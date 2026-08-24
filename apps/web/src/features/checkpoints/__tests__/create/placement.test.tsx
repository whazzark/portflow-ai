import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('arms placement mode, suspends existing marker selection, and places a pending marker on map click', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })

  await user.click(screen.getByRole('button', { name: 'New dock' }))

  expect(await screen.findByRole('heading', { name: 'Create dock' })).toBeInTheDocument()

  // Existing markers stay visible but are not selectable while armed.
  await user.click(screen.getByRole('button', { name: 'View dock North Dock (Available)' }))
  expect(screen.queryByRole('heading', { name: 'North Dock' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Simulate map click to place dock' }))

  expect(await screen.findByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('20.5')

  await user.click(screen.getByRole('button', { name: 'Simulate dragging pending marker' }))

  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('11.5'))
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('21.5')
})

test('allows typing a decimal coordinate without it being reset mid-entry', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place dock' }))

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '48.10')

  // Regression: the sync-from-pending effect must not canonicalize "48.10" back to "48.1"
  // (or worse, corrupt a partially typed decimal like "48.") on every keystroke that parses.
  expect(latitudeInput).toHaveValue('48.10')
})
