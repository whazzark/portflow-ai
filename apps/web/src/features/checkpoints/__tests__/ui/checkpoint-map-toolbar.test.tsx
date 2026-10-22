import { screen, within } from '@testing-library/react'
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

// Fixtures: docks Bêta (available), North (available), Retired (archived); weighing areas Alpha
// and Beta Scale (available), Retired and Gamma Scale (archived).

test('shows the type and status toggles with their counts in a floating toolbar', async () => {
  renderCheckpoints()

  const types = await screen.findByRole('group', { name: 'Checkpoint types' })
  // Weighing areas load separately from docks, so wait for the counts that include them.
  expect(await within(types).findByRole('button', { name: 'Weighing areas 4' })).toBeInTheDocument()
  expect(within(types).getByRole('button', { name: 'Docks 3' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(types).getByRole('button', { name: 'Weighing areas 4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const statuses = screen.getByRole('group', { name: 'Filter by checkpoint status' })
  expect(within(statuses).getByRole('button', { name: 'Available 4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(statuses).getByRole('button', { name: 'Archived 3' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('combobox', { name: 'Search checkpoints' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Filter checkpoints/ })).not.toBeInTheDocument()
})

test('counts each type within the selected statuses and each status within the selected types', async () => {
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=available&kinds=dock')

  expect(await screen.findByRole('button', { name: 'Docks 2' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Weighing areas 2' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(screen.getByRole('button', { name: 'Available 2' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archived 1' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('maps the status toggles onto the status parameter', async () => {
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  const { router } = renderCheckpoints('/checkpoints?status=available')

  await user.click(await screen.findByRole('button', { name: /^Archived/ }))
  expect(router.state.location.search).toMatchObject({ status: 'all' })

  await user.click(screen.getByRole('button', { name: /^Available/ }))
  expect(router.state.location.search).toMatchObject({ status: 'archived' })
  expect(screen.getByRole('button', { name: /^Archived/ })).toBeDisabled()
})

test('maps the type toggles onto the kinds parameter and keeps one type on', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: /^Docks/ }))
  expect(router.state.location.search).toMatchObject({ kinds: 'weighing-area' })
  expect(screen.getByRole('button', { name: /^Weighing areas/ })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: /^Docks/ }))
  expect(router.state.location.search).not.toHaveProperty('kinds')
})
