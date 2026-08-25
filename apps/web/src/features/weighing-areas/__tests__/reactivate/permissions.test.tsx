import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DOCK_OBSERVER } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]

test('offers no reactivate action on any weighing area to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
    }),
  )
  await screen.findByRole('heading', { name: RETIRED_SCALE.name })
  expect(screen.queryByRole('button', { name: 'Reactivate weighing area' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await screen.findByRole('heading', { name: ALPHA_SCALE.name })
  expect(screen.queryByRole('button', { name: 'Reactivate weighing area' })).not.toBeInTheDocument()
})

test('offers no select mode to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')

  await screen.findByRole('button', {
    name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
  })

  expect(screen.queryByRole('button', { name: 'Select weighing areas' })).not.toBeInTheDocument()
})

test('forcing select mode through the URL gives a non-administrator no checkable markers or toolbar', async () => {
  mockDocks(DOCK_OBSERVER)
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived&selecting=weighing-areas')

  // The archived weighing area is still a details trigger, never a selection checkbox, and no
  // bulk toolbar exists to act on it: server-side authorization stays the real gate either way.
  expect(
    await screen.findByRole('button', {
      name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
    }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
})
