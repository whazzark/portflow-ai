import { fireEvent, screen } from '@testing-library/react'
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

test('shift-clicking an available dock marker enters select mode and checks it directly', async () => {
  mockDocks()
  renderCheckpoints()

  const marker = await screen.findByRole('button', {
    name: `View dock ${NORTH_DOCK.name} (Available)`,
  })
  fireEvent.click(marker, { shiftKey: true })

  expect(
    await screen.findByRole('button', { name: `Deselect dock ${NORTH_DOCK.name}` }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: NORTH_DOCK.name })).not.toBeInTheDocument()
})

test('a plain click (no shift) still opens details when not already selecting', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )

  expect(await screen.findByRole('heading', { name: NORTH_DOCK.name })).toBeInTheDocument()
})

test('shift-clicking a second dock while already selecting just toggles it', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }))
  fireEvent.click(screen.getByRole('button', { name: `Select dock ${BETA_DOCK.name}` }), {
    shiftKey: true,
  })

  expect(screen.getByText('2 selected')).toBeInTheDocument()
})

test('Ctrl+A selects every visible available dock and enters select mode on the fly', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Deselect dock ${BETA_DOCK.name}` }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Deselect dock ${NORTH_DOCK.name}` }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).not.toBeInTheDocument()
})

test('Ctrl+A does not hijack the native select-all while typing in the search field', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` })
  await user.click(screen.getByRole('textbox', { name: 'Search checkpoints' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('Escape clears an in-progress selection without leaving select mode', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.keyboard('{Escape}')

  expect(screen.getByText('0 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop selecting docks' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: `Select dock ${NORTH_DOCK.name}` })).toBeInTheDocument()
})
