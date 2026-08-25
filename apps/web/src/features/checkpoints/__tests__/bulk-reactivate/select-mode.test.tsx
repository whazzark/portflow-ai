import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const BETA_DOCK = DOCKS[0]
const NORTH_DOCK = DOCKS[1]
const RETIRED_DOCK = DOCKS[2]

test('offers both available and archived docks as checkable while nothing is checked', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))

  expect(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).toBeInTheDocument()
})

test('checking an archived dock fixes the intent to reactivation and excludes available docks', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }))

  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }),
  ).not.toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  ).toBeInTheDocument()
})

test('checking an available dock fixes the intent to archiving and excludes archived docks', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }))

  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).not.toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` }),
  ).toBeInTheDocument()
})

test('clearing the selection makes every dock checkable again', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }))
  await user.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(
    await screen.findByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).toBeInTheDocument()
})

test('unchecking the only checked dock releases the intent for every other dock', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }))
  await user.click(screen.getByRole('button', { name: `Deselect dock ${RETIRED_DOCK.name}` }))

  expect(
    await screen.findByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }),
  ).toBeInTheDocument()
})

test('a selection of several archived docks keeps the reactivate intent', async () => {
  mockDocks()
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }))

  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('a selection of several available docks keeps the archive intent', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${BETA_DOCK.name}` }))
  await user.click(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }))

  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(screen.getByText('2 selected')).toBeInTheDocument()
})
