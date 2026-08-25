import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DOCK_OBSERVER, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const NORTH_DOCK = DOCKS[1]
const RETIRED_DOCK = DOCKS[2]
const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]

test('offers a Select docks toggle to an administrator', async () => {
  mockDocks()
  renderCheckpoints()

  expect(await screen.findByRole('button', { name: 'Select docks' })).toBeInTheDocument()
})

test('does not offer the toggle to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints()

  await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` })

  expect(screen.queryByRole('button', { name: 'Select docks' })).not.toBeInTheDocument()
})

test('activating select mode sets the URL and hides create actions', async () => {
  mockDocks()
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))

  expect(router.state.location.search).toMatchObject({ selecting: 'docks' })
  expect(screen.queryByRole('button', { name: 'New dock' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'New weighing area' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop selecting docks' })).toBeInTheDocument()
})

test('turns a dock marker click into a checked toggle instead of opening details', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  const marker = screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` })
  await user.click(marker)

  expect(screen.getByRole('button', { name: `Deselect dock ${NORTH_DOCK.name}` })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.queryByRole('heading', { name: NORTH_DOCK.name })).not.toBeInTheDocument()
})

test('leaves weighing area marker clicks opening the details sheet', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(
    await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' }),
  )

  expect(await screen.findByRole('heading', { name: 'Alpha Scale' })).toBeInTheDocument()
})

test('excludes an archived dock marker once an available-dock selection is in progress', async () => {
  // A selection is homogeneous by status (#201): checking an available dock first fixes the
  // selection to archiving, so an archived dock stays a details trigger rather than becoming
  // checkable — the counterpart of #201's own "select docks archived-only" case.
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }))

  expect(
    screen.queryByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).not.toBeInTheDocument()
  await user.click(
    await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` }),
  )
  expect(await screen.findByRole('heading', { name: RETIRED_DOCK.name })).toBeInTheDocument()
})

// Weighing-area half of the same select mode (spec FR-038): interaction parity with docks above.

test('offers a Select weighing areas toggle to an administrator', async () => {
  mockDocks()
  renderCheckpoints()

  expect(await screen.findByRole('button', { name: 'Select weighing areas' })).toBeInTheDocument()
})

test('does not offer the weighing-area toggle to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints()

  await screen.findByRole('button', {
    name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
  })

  expect(screen.queryByRole('button', { name: 'Select weighing areas' })).not.toBeInTheDocument()
})

test('activating weighing-area select mode sets the URL and hides create actions', async () => {
  mockDocks()
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))

  expect(router.state.location.search).toMatchObject({ selecting: 'weighing-areas' })
  expect(screen.queryByRole('button', { name: 'New dock' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'New weighing area' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop selecting weighing areas' })).toBeInTheDocument()
})

test('turns a weighing-area marker click into a checked toggle instead of opening details', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  const marker = screen.getByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` })
  await user.click(marker)

  expect(
    screen.getByRole('button', { name: `Deselect weighing area ${ALPHA_SCALE.name}` }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('heading', { name: ALPHA_SCALE.name })).not.toBeInTheDocument()
})

test('leaves dock marker clicks opening the details sheet while selecting weighing areas', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )

  expect(await screen.findByRole('heading', { name: NORTH_DOCK.name })).toBeInTheDocument()
})

test('keeps an archived weighing-area marker opening details once the selection is archiving', async () => {
  // Mirrors the dock case above: checking an available weighing area fixes the selection to
  // archiving, so an archived one stays a details trigger rather than becoming checkable. With
  // nothing checked it *is* checkable, because it could start a reactivation instead.
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(screen.getByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` }))

  expect(
    screen.queryByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  ).not.toBeInTheDocument()
  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
    }),
  )
  expect(await screen.findByRole('heading', { name: RETIRED_SCALE.name })).toBeInTheDocument()
})

test('a weighing area hidden by search stays checked, but changing the status filter clears the actionable selection', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(screen.getByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Search checkpoints' }), 'zzz-no-match')

  // Search narrows what is displayed, not what was chosen (spec FR-036): the count survives even
  // though the checked marker itself is no longer a search match.
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.clear(screen.getByRole('textbox', { name: 'Search checkpoints' }))
  await user.click(screen.getByRole('button', { name: /Filter checkpoints:/ }))
  await user.click(screen.getByRole('menuitemradio', { name: /Archived/ }))

  // The status filter changes what is *eligible*, so it does prune the selection, unlike search.
  expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
})
