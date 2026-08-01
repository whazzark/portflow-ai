import { expect, test } from 'vitest'
import {
  isCheckpointSearchMatch,
  normalizeCheckpointSearch,
  presentCheckpoints,
} from '@/features/checkpoints/checkpoint-search'
import {
  checkpointLayerVisibilityFromFilter,
  DEFAULT_CHECKPOINT_LAYER_VISIBILITY,
} from '@/features/checkpoints/types'

test('normalizes map entity search independently of a domain feature', () => {
  expect(normalizeCheckpointSearch('  Quai d’Été  ')).toBe('quai d’ete')
  expect(isCheckpointSearchMatch({ name: 'Quai d’Été' }, 'ete')).toBe(true)
})

test('shows both delivered checkpoint layers by default', () => {
  expect(DEFAULT_CHECKPOINT_LAYER_VISIBILITY).toEqual({
    DOCK: true,
    WEIGHING_AREA: true,
  })
})

test('falls back to both layers for an invalid resource-kind filter', () => {
  expect(checkpointLayerVisibilityFromFilter('invalid')).toEqual(
    DEFAULT_CHECKPOINT_LAYER_VISIBILITY,
  )
})

test('filters presented checkpoints by visible resource kind', () => {
  const checkpoints = [
    {
      id: 'dock-1',
      kind: 'DOCK' as const,
      name: 'Dock',
      latitude: 1,
      longitude: 2,
      status: 'AVAILABLE' as const,
    },
    {
      id: 'area-1',
      kind: 'WEIGHING_AREA' as const,
      name: 'Area',
      latitude: 3,
      longitude: 4,
      status: 'AVAILABLE' as const,
    },
  ]

  expect(
    presentCheckpoints(checkpoints, 'all', '', { DOCK: true, WEIGHING_AREA: false }),
  ).toHaveLength(1)
  expect(
    presentCheckpoints(checkpoints, 'all', '', { DOCK: false, WEIGHING_AREA: true }),
  ).toHaveLength(1)
})
