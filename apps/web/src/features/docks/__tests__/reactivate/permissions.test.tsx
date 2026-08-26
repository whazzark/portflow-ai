import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DOCK_OBSERVER, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const NORTH_DOCK = DOCKS[1]
const RETIRED_DOCK = DOCKS[2]

test('offers no reactivate or select actions to an Observer anywhere on the checkpoints map', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  expect(
    await screen.findByRole('button', { name: 'View dock North Dock (Available)' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Select docks' })).not.toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` }),
  )
  await screen.findByRole('heading', { name: RETIRED_DOCK.name })
  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))

  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await screen.findByRole('heading', { name: NORTH_DOCK.name })
  expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
})

test('forcing selecting=docks in the URL offers no checkable archived markers or bulk bar to an Observer', async () => {
  mockDocks(DOCK_OBSERVER)
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?selecting=docks&status=all')

  expect(
    await screen.findByRole('button', { name: `View dock ${RETIRED_DOCK.name} (Archived)` }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
