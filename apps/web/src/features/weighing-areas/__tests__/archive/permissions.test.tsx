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

test('offers no archive action on any weighing area to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await screen.findByRole('heading', { name: ALPHA_SCALE.name })
  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
    }),
  )
  await screen.findByRole('heading', { name: RETIRED_SCALE.name })
  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})
