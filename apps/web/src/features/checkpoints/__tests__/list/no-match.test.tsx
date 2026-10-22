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

test('names a search that matches nothing and offers to clear it or include archived', async () => {
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string or selector, not a secret
  const { router } = renderCheckpoints('/checkpoints?status=available')

  await user.type(await screen.findByRole('combobox', { name: 'Search checkpoints' }), 'retired')

  const notice = (await screen.findByText('No checkpoint matches “retired”')).closest(
    // biome-ignore lint/security/noSecrets: route search string or selector, not a secret
    '[role="status"]',
  )
  expect(notice).toHaveTextContent('No checkpoint matches “retired”')
  expect(notice).toHaveTextContent(
    'Search looks at names in the selected types and status. Turn on Archived to include archived checkpoints, or clear the search.',
  )

  await user.click(screen.getByRole('button', { name: 'Include archived' }))
  expect(router.state.location.search).toMatchObject({ status: 'all', search: 'retired' })
  expect(screen.queryByText(/No checkpoint matches/)).not.toBeInTheDocument()
})

test('clears the search from the no-match state', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await user.type(await screen.findByRole('combobox', { name: 'Search checkpoints' }), 'missing')

  expect(await screen.findByText('No checkpoint matches “missing”')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Include archived' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(router.state.location.search).toMatchObject({ search: '' })
  expect(screen.queryByText(/No checkpoint matches/)).not.toBeInTheDocument()
})
