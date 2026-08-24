import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DOCK_OBSERVER, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const NORTH_DOCK = DOCKS[1]
const RETIRED_DOCK = DOCKS[2]

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

test('keeps an archived dock marker opening details instead of offering it as checkable', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))

  expect(
    screen.queryByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).not.toBeInTheDocument()
  await user.click(
    await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` }),
  )
  expect(await screen.findByRole('heading', { name: RETIRED_DOCK.name })).toBeInTheDocument()
})
