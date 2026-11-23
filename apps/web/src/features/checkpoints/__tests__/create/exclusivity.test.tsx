import { act, screen, waitFor, within } from '@testing-library/react'
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

test('replaces the toolbar with the placement banner while placing', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await startCreating(user, 'New dock')

  expect(router.state.location.search).toMatchObject({ create: 'dock' })
  expect(
    screen.getByText('Placing a new dock · click the map where trucks are loaded'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Search checkpoints' })).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Checkpoint types' })).not.toBeInTheDocument()
})

test('switching creation kind through the address discards the pending pin', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await startCreating(user, 'New weighing area')
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  expect(screen.getByTestId('pending-checkpoint-marker')).toBeInTheDocument()

  await act(() =>
    router.navigate({
      to: '/checkpoints',
      search: { search: '', status: 'all', create: 'dock' },
    }),
  )

  expect(await screen.findByRole('heading', { name: 'New dock' })).toBeInTheDocument()
  expect(
    screen.getByText('Placing a new dock · click the map where trucks are loaded'),
  ).toBeInTheDocument()
  expect(screen.queryByTestId('pending-checkpoint-marker')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('')
})

test('leaves placement from the banner, the card and Escape without creating anything', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })

  await startCreating(user, 'New dock')
  const banner = screen
    .getByText('Placing a new dock · click the map where trucks are loaded')
    .closest('div') as HTMLElement
  await user.click(within(banner).getByRole('button', { name: 'Cancel' }))
  expect(router.state.location.search).not.toHaveProperty('create')

  await startCreating(user, 'New weighing area')
  const card = await screen.findByRole('complementary', { name: 'New weighing area' })
  await user.click(within(card).getByRole('button', { name: 'Cancel' }))
  expect(router.state.location.search).not.toHaveProperty('create')

  await startCreating(user, 'New dock')
  await user.click(await screen.findByRole('textbox', { name: 'Dock name' }))
  await user.keyboard('{Escape}')
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('create'))
  expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
})
