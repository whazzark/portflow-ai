import { expect, test } from 'vitest'
import {
  parseCheckpointSelection,
  serializeCheckpointSelection,
} from '@/features/checkpoints/checkpoint-selection'

test('round-trips typed checkpoint selections', () => {
  const selection = { id: 'dock-id', kind: 'DOCK' } as const

  expect(serializeCheckpointSelection(selection)).toBe('dock:dock-id')
  expect(parseCheckpointSelection('dock:dock-id')).toEqual(selection)
  expect(parseCheckpointSelection('weighing-area:scale-id')).toEqual({
    id: 'scale-id',
    kind: 'WEIGHING_AREA',
  })
})

test.each([undefined, '', 'dock:', 'missing-kind:id', 'dock:id:extra'])(
  'rejects malformed checkpoint selection %s',
  (value) => {
    expect(parseCheckpointSelection(value)).toBeUndefined()
  },
)
