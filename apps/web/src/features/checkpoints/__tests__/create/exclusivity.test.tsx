import { screen } from '@testing-library/react'
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

test('switching from weighing-area creation to dock creation discards the pending weighing-area marker', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  expect(screen.getByTestId('pending-checkpoint-marker')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Create weighing area' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'New dock' }))

  expect(await screen.findByRole('heading', { name: 'Create dock' })).toBeInTheDocument()
  expect(screen.queryByTestId('pending-checkpoint-marker')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Dock name' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('')
})

test('switching from dock creation to weighing-area creation discards the pending dock marker', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  expect(screen.getByTestId('pending-checkpoint-marker')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'New weighing area' }))

  expect(await screen.findByRole('heading', { name: 'Create weighing area' })).toBeInTheDocument()
  expect(screen.queryByTestId('pending-checkpoint-marker')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Weighing area name' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('')
})

test('at most one creation action is ever active: both remain available while the other is armed', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New dock' }))

  expect(screen.getByRole('button', { name: 'New dock' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New weighing area' })).toBeInTheDocument()
})
