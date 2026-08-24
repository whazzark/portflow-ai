import { screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DOCK_OBSERVER } from '@/features/docks/__tests__/support/fixtures'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

test('does not offer dock creation to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints()

  await screen.findByRole('region', { name: 'Checkpoint map' })

  expect(screen.queryByRole('button', { name: 'New dock' })).not.toBeInTheDocument()
})

test('ignores a direct create=dock URL for a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints('/checkpoints?create=dock')

  await screen.findByRole('region', { name: 'Checkpoint map' })

  expect(screen.queryByRole('heading', { name: 'Create dock' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
