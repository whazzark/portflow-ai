import { expect, test } from 'vitest'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import { toWeighingAreaCheckpoint } from '@/features/weighing-areas/weighing-area-checkpoint-adapter'

test('adapts available and archived collection DTOs with exact coordinates', () => {
  expect(WEIGHING_AREAS.map(toWeighingAreaCheckpoint)).toEqual([
    {
      id: WEIGHING_AREAS[0].id,
      kind: 'WEIGHING_AREA',
      latitude: -90,
      longitude: 180,
      name: 'Alpha Scale',
      status: 'AVAILABLE',
    },
    {
      id: WEIGHING_AREAS[1].id,
      kind: 'WEIGHING_AREA',
      latitude: 90,
      longitude: -180,
      name: 'Retired Scale',
      status: 'ARCHIVED',
    },
    {
      id: WEIGHING_AREAS[2].id,
      kind: 'WEIGHING_AREA',
      latitude: 45.75,
      longitude: 4.85,
      name: 'Beta Scale',
      status: 'AVAILABLE',
    },
    {
      id: WEIGHING_AREAS[3].id,
      kind: 'WEIGHING_AREA',
      latitude: 45.76,
      longitude: 4.86,
      name: 'Gamma Scale',
      status: 'ARCHIVED',
    },
  ])
})

test('uses the complete weighing-area collection query contract', () => {
  expect(weighingAreaQueries.list().queryKey[0]).toEqual(['weighingAreas', 'index'])
})
