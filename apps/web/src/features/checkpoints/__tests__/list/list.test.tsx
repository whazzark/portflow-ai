import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { CHECKPOINT_STATUS_LABELS } from '@/features/checkpoints/types'
import { DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('shows all available and archived docks on a full-page map by default', async () => {
  const { router } = renderCheckpoints()
  const map = await screen.findByRole('region', { name: 'Checkpoint map' })

  for (const dock of DOCKS) {
    expect(
      within(map).getByRole('button', {
        name: `View dock ${dock.name} (${CHECKPOINT_STATUS_LABELS[dock.status]})`,
      }),
    ).toBeInTheDocument()
  }

  expect(screen.queryByRole('table', { name: 'Docks' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Docks' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Search checkpoints' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Clear checkpoint search input' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filter checkpoints: All' })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ search: '', status: 'all' })
})

test('filters map membership by lifecycle status', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await user.click(screen.getByRole('button', { name: 'Filter checkpoints: All' }))
  await user.click(screen.getByRole('menuitemradio', { name: /Archived/ }))

  const map = screen.getByRole('region', { name: 'Checkpoint map' })
  expect(
    within(map).getByRole('button', { name: 'View dock Retired Dock (Archived)' }),
  ).toBeInTheDocument()
  expect(
    within(map).queryByRole('button', { name: 'View dock North Dock (Available)' }),
  ).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ status: 'archived' })
})

test('emphasizes normalized name matches without removing nonmatches', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await user.type(screen.getByRole('textbox', { name: 'Search checkpoints' }), 'beta')

  expect(screen.getByRole('button', { name: 'View dock Bêta Dock (Available)' })).toHaveAttribute(
    'data-search-match',
    'true',
  )
  expect(screen.getByRole('button', { name: 'View dock North Dock (Available)' })).toHaveAttribute(
    'data-search-match',
    'false',
  )
  expect(router.state.location.search).toMatchObject({ search: 'beta' })
})

test('keeps context and offers to clear a zero-match search', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await user.type(screen.getByRole('textbox', { name: 'Search checkpoints' }), 'missing')

  expect(screen.getByText('No checkpoints match “missing”.')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'View dock North Dock (Available)' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(screen.getByRole('textbox', { name: 'Search checkpoints' })).toHaveValue('')
  expect(screen.queryByText(/No checkpoints match/)).not.toBeInTheDocument()
})

test('restores filter and search from the URL', async () => {
  renderCheckpoints(`/checkpoints?${'status=archived'}&${'search=retired'}`)

  expect(
    await screen.findByRole('button', { name: 'View dock Retired Dock (Archived)' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'View dock North Dock (Available)' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Search checkpoints' })).toHaveValue('retired')
  expect(screen.getByRole('button', { name: 'Filter checkpoints: Archived' })).toBeInTheDocument()
})
