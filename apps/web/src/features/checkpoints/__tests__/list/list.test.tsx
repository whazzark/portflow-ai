import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { CHECKPOINT_STATUS_LABELS } from '@/features/checkpoints/types'
import { DOCK_ADMIN, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { weighingAreasSequenceHandler } from '@/features/weighing-areas/__tests__/support/handlers'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('shows all available and archived checkpoints on a full-page map by default', async () => {
  const { router } = renderCheckpoints()
  const map = await screen.findByRole('region', { name: 'Checkpoint map' })

  for (const dock of DOCKS) {
    expect(
      within(map).getByRole('button', {
        name: `View dock ${dock.name} (${CHECKPOINT_STATUS_LABELS[dock.status]})`,
      }),
    ).toBeInTheDocument()
  }
  for (const area of WEIGHING_AREAS) {
    expect(
      await within(map).findByRole('button', {
        name: `View weighing area ${area.name} (${CHECKPOINT_STATUS_LABELS[area.status]})`,
      }),
    ).toHaveAttribute('data-checkpoint-kind', 'WEIGHING_AREA')
  }

  expect(screen.queryByRole('table', { name: 'Docks' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Docks' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Search checkpoints' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Clear checkpoint search input' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Filter checkpoints: All/ })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ search: '', status: 'all' })
})

test('filters map membership by lifecycle status', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await user.click(screen.getByRole('button', { name: /Filter checkpoints: All/ }))
  await user.click(screen.getByRole('menuitemradio', { name: /Archived/ }))

  const map = screen.getByRole('region', { name: 'Checkpoint map' })
  expect(
    within(map).getByRole('button', { name: 'View dock Retired Dock (Archived)' }),
  ).toBeInTheDocument()
  expect(
    await within(map).findByRole('button', { name: 'View weighing area Retired Scale (Archived)' }),
  ).toBeInTheDocument()
  expect(
    within(map).queryByRole('button', { name: 'View dock North Dock (Available)' }),
  ).not.toBeInTheDocument()
  expect(
    within(map).queryByRole('button', { name: 'View weighing area Alpha Scale (Available)' }),
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

test('applies search across both resource kinds without removing spatial context', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await user.type(screen.getByRole('textbox', { name: 'Search checkpoints' }), 'alpha scale')

  expect(
    await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' }),
  ).toHaveAttribute('data-search-match', 'true')
  expect(screen.getByRole('button', { name: 'View dock North Dock (Available)' })).toHaveAttribute(
    'data-search-match',
    'false',
  )
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
  expect(screen.getByRole('button', { name: /Filter checkpoints: Archived/ })).toBeInTheDocument()
})

test('filters docks and weighing areas independently and persists the layer in the URL', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  await screen.findByRole('region', { name: 'Checkpoint map' })

  await user.click(screen.getByRole('button', { name: /Filter checkpoints: All/ }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Docks' }))

  const map = screen.getByRole('region', { name: 'Checkpoint map' })
  expect(within(map).getAllByRole('button', { name: /View weighing area/ })).not.toHaveLength(0)
  expect(within(map).queryByRole('button', { name: /View dock/ })).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ kinds: 'weighing-area' })

  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Docks' }))
  expect(router.state.location.search).not.toHaveProperty('kinds')
  expect(within(map).getAllByRole('button', { name: /View dock/ })).not.toHaveLength(0)
})

test('restores a resource layer filter from the URL', async () => {
  renderCheckpoints('/checkpoints?kinds=dock')

  const map = await screen.findByRole('region', { name: 'Checkpoint map' })
  expect(within(map).getAllByRole('button', { name: /View dock/ })).not.toHaveLength(0)
  expect(within(map).queryByRole('button', { name: /View weighing area/ })).not.toBeInTheDocument()
})

test('keeps the legend aligned with the selected resource layer', async () => {
  const { router } = renderCheckpoints('/checkpoints?kinds=dock')

  await screen.findByRole('region', { name: 'Checkpoint map' })
  expect(screen.getByRole('region', { name: 'Checkpoint legend' })).toHaveTextContent('Dock')
  expect(screen.getByRole('region', { name: 'Checkpoint legend' })).not.toHaveTextContent(
    'Weighing area',
  )
  expect(router.state.location.search).toMatchObject({ kinds: 'dock' })
})

test('admits resource identities independently without duplicate or key collisions', async () => {
  const sharedIdArea = { ...WEIGHING_AREAS[0], id: DOCKS[0].id }
  mockDocks(DOCK_ADMIN, [DOCKS[0]], [sharedIdArea])
  renderCheckpoints()

  expect(
    await screen.findByRole('button', {
      name: `View dock ${DOCKS[0].name} (${CHECKPOINT_STATUS_LABELS[DOCKS[0].status]})`,
    }),
  ).toBeInTheDocument()
  expect(
    await screen.findByRole('button', {
      name: `View weighing area ${sharedIdArea.name} (${CHECKPOINT_STATUS_LABELS[sharedIdArea.status]})`,
    }),
  ).toBeInTheDocument()
})

test('replaces a refreshed weighing-area status without admitting a duplicate marker', async () => {
  const available = WEIGHING_AREAS[0]
  const archived = {
    ...available,
    archivedAt: '2026-08-01T00:00:00.000Z',
    status: 'ARCHIVED' as const,
  }
  server.use(weighingAreasSequenceHandler([{ areas: [available] }, { areas: [archived] }]))
  const { queryClient } = renderCheckpoints()

  expect(
    await screen.findByRole('button', {
      name: `View weighing area ${available.name} (Available)`,
    }),
  ).toBeInTheDocument()

  await queryClient.invalidateQueries({ queryKey: weighingAreaQueries.list().queryKey })

  expect(
    await screen.findByRole('button', {
      name: `View weighing area ${available.name} (Archived)`,
    }),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.queryByRole('button', {
        name: `View weighing area ${available.name} (Available)`,
      }),
    ).not.toBeInTheDocument(),
  )
  expect(
    screen.getAllByRole('button', { name: new RegExp(`View weighing area ${available.name}`) }),
  ).toHaveLength(1)
})
