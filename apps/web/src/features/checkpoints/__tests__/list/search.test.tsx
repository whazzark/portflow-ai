import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

const betaDock = DOCKS.find((dock) => dock.name === 'Bêta Dock')

test('lists matching checkpoints of every type under the field with a summary', async () => {
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=available')

  await user.type(await screen.findByRole('combobox', { name: 'Search checkpoints' }), 'beta')

  const list = await screen.findByRole('listbox', { name: 'Matching checkpoints' })
  const options = within(list).getAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual([
    'Bêta DockDock',
    'Beta ScaleWeighing area',
  ])
  expect(screen.getByText('2 of 4 available · Enter to zoom to all matches')).toBeInTheDocument()
})

test('shows only the matching markers while searching', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()

  await user.type(await screen.findByRole('combobox', { name: 'Search checkpoints' }), 'BETA')
  // The open suggestion list hides the rest of the page from assistive technology; close it.
  await user.keyboard('{Escape}')

  const map = screen.getByRole('region', { name: 'Checkpoint map' })
  expect(within(map).getByRole('button', { name: 'View dock Bêta Dock (Available)' })).toBeVisible()
  expect(
    within(map).getByRole('button', { name: 'View weighing area Beta Scale (Available)' }),
  ).toBeVisible()
  expect(
    within(map).queryByRole('button', { name: 'View dock North Dock (Available)' }),
  ).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ search: 'BETA' })
})

test('opens the picked checkpoint without rewriting the search', async () => {
  const user = userEvent.setup()
  const { router } = renderCheckpoints()
  const input = await screen.findByRole('combobox', { name: 'Search checkpoints' })

  await user.type(input, 'beta')
  await user.click(await screen.findByRole('option', { name: /Bêta Dock/ }))

  expect(router.state.location.search).toMatchObject({
    checkpointId: `dock:${betaDock?.id}`,
    search: 'beta',
  })
  expect(await screen.findByRole('heading', { name: 'Bêta Dock' })).toBeInTheDocument()
})

test('asks the map to frame every match on Enter', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await user.type(
    await screen.findByRole('combobox', { name: 'Search checkpoints' }),
    'scale{Enter}',
  )

  const map = screen.getByRole('region', { name: 'Checkpoint map' })
  expect(map.getAttribute('data-fit-request')?.split(',')).toHaveLength(4)
})

test('restores the search from the URL', async () => {
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived&search=retired')

  expect(
    await screen.findByRole('button', { name: 'View dock Retired Dock (Archived)' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Search checkpoints' })).toHaveValue('retired')
})
