import { expect, test } from 'vitest'
import {
  isCheckpointSearchMatch,
  normalizeCheckpointSearch,
} from '@/features/checkpoints/checkpoint-search'
import { DEFAULT_CHECKPOINT_LAYER_VISIBILITY } from '@/features/checkpoints/types'

test('normalizes map entity search independently of a domain feature', () => {
  expect(normalizeCheckpointSearch('  Quai d’Été  ')).toBe('quai d’ete')
  expect(isCheckpointSearchMatch({ name: 'Quai d’Été' }, 'ete')).toBe(true)
})

test('keeps docks visible while future weighing area layers are opt-in', () => {
  expect(DEFAULT_CHECKPOINT_LAYER_VISIBILITY).toEqual({
    DOCK: true,
    WEIGHING_AREA: false,
  })
})
