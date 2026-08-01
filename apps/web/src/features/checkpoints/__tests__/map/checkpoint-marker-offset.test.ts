import { expect, test } from 'vitest'
import { getCheckpointMarkerOffset } from '@/features/checkpoints/map/checkpoint-marker-offset'

test('fans out markers that share coordinates with deterministic offsets', () => {
  const checkpoints = [
    { id: 'a', latitude: 46.1, longitude: -1.2 },
    { id: 'b', latitude: 46.1, longitude: -1.2 },
    { id: 'c', latitude: 46.1, longitude: -1.2 },
  ]

  expect(getCheckpointMarkerOffset(checkpoints[0], checkpoints)).toEqual([0, -24])
  expect(getCheckpointMarkerOffset(checkpoints[1], checkpoints)).toEqual([21, 12])
  expect(getCheckpointMarkerOffset(checkpoints[2], checkpoints)).toEqual([-21, 12])
})

test('does not offset a marker when its coordinate is unique', () => {
  const checkpoint = { id: 'a', latitude: 46.1, longitude: -1.2 }

  expect(getCheckpointMarkerOffset(checkpoint, [checkpoint])).toEqual([0, 0])
})

test('separates checkpoints whose coordinates are nearly identical', () => {
  const checkpoints = [
    { id: 'a', latitude: 46.1591, longitude: -1.1532 },
    { id: 'b', latitude: 46.15913, longitude: -1.15323 },
  ]

  expect(getCheckpointMarkerOffset(checkpoints[0], checkpoints)).not.toEqual([0, 0])
  expect(getCheckpointMarkerOffset(checkpoints[1], checkpoints)).not.toEqual([0, 0])
})
