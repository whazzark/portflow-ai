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

test('Ctrl+A under the archived filter selects every visible archived dock and reads Reactivate selected', async () => {
  mockDocks()
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')

  await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` })
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Deselect dock ${RETIRED_DOCK.name}` }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
})

test('Ctrl+A under the available filter still selects only available docks and reads Archive selected', async () => {
  mockDocks()
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=available')

  await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('Ctrl+A extends an in-progress archived selection with archived docks only', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select dock ${BETA_DOCK.name}` }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `View dock ${BETA_DOCK.name} (Available)` }),
  ).toBeInTheDocument()
})

test('Ctrl+A does not hijack the native select-all while typing in the search field, under the archived filter', async () => {
  mockDocks()
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')

  await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` })
  await user.click(screen.getByRole('textbox', { name: 'Search checkpoints' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
})
