import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { mockDocks, renderCheckpoints, startCreating } from '../support/test-helpers'

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

  await startCreating(user, 'New dock')

  expect(await screen.findByRole('heading', { name: 'New dock' })).toBeInTheDocument()

  // Existing markers stay visible but are not selectable while armed.
  await user.click(screen.getByRole('button', { name: 'View dock North Dock (Available)' }))
  expect(screen.queryByRole('heading', { name: 'North Dock' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

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
  await startCreating(user, 'New dock')
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '48.10')

  // Regression: the sync-from-pending effect must not canonicalize "48.10" back to "48.1"
  // (or worse, corrupt a partially typed decimal like "48.") on every keystroke that parses.
  expect(latitudeInput).toHaveValue('48.10')
})

test('offers both creation kinds with their purpose from the toolbar Create menu', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })

  await user.click(screen.getByRole('button', { name: 'Create' }))

  expect(await screen.findByRole('menuitem', { name: /^New dock/ })).toHaveTextContent(
    'Berth where trucks are loaded',
  )
  expect(screen.getByRole('menuitem', { name: /^New weighing area/ })).toHaveTextContent(
    'Weighbridge where trucks are weighed',
  )
})

test('opens the creation card with its placement hint and fields', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await startCreating(user, 'New weighing area')

  expect(
    screen.getByText('Placing a new weighing area · click the weighbridge position'),
  ).toBeInTheDocument()
  const card = await screen.findByRole('complementary', { name: 'New weighing area' })
  expect(card).toHaveTextContent('Place the pin where trucks stand on the weighbridge.')
  expect(within(card).getByRole('textbox', { name: 'Weighing area name' })).toBeRequired()
  expect(within(card).getByRole('textbox', { name: 'Latitude' })).toBeInTheDocument()
  expect(within(card).getByRole('textbox', { name: 'Longitude' })).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: 'Create weighing area' })).toBeDisabled()
  expect(within(card).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
})
