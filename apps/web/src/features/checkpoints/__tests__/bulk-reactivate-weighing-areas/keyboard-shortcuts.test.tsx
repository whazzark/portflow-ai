import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]
const GAMMA_SCALE = WEIGHING_AREAS[3]

test('Ctrl+A selects every visible archived weighing area under the archived filter', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?kinds=weighing-area&status=archived')

  await screen.findByRole('button', {
    name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
  })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Deselect weighing area ${RETIRED_SCALE.name}` }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Deselect weighing area ${GAMMA_SCALE.name}` }),
  ).toBeInTheDocument()
})

test('Ctrl+A still selects available weighing areas under the available filter', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?kinds=weighing-area&status=available')

  await screen.findByRole('button', {
    name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
  })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('Ctrl+A extends an archived selection with archived weighing areas only', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?kinds=weighing-area&status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  )

  await user.keyboard('{Control>}a{/Control}')

  // The in-progress reactivation intent wins over the status filter, so the two available
  // weighing areas are left alone.
  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
})

test('Ctrl+A stays inert while typing in the search field', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?kinds=weighing-area&status=archived')

  await screen.findByRole('button', {
    name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
  })
  await user.click(screen.getByRole('textbox', { name: 'Search checkpoints' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
})
